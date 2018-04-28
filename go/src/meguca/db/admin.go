package db

import (
	"database/sql"
	"time"

	"meguca/auth"
	"meguca/common"
	"meguca/config"

	"github.com/lib/pq"
)

// GetIP returns an IP of the poster that created a post. Posts older than 7
// days will not have this information.
func GetIP(id uint64) (string, error) {
	var ip sql.NullString
	err := prepared["get_ip"].QueryRow(id).Scan(&ip)
	return ip.String, err
}

// Ban IPs from accessing a specific board. Need to target posts. Returns all
// banned IPs.
func Ban(board, reason, by string, expires time.Time, ids ...uint64) (
	ips map[string]uint64, err error,
) {
	type post struct {
		id, op uint64
	}

	// Retrieve matching posts
	ips = make(map[string]uint64, len(ids))
	posts := make([]post, 0, len(ids))
	for _, id := range ids {
		ip, err := GetIP(id)
		switch err {
		case nil:
		case sql.ErrNoRows:
			continue
		default:
			return nil, err
		}
		ips[ip] = id
		posts = append(posts, post{id: id})
	}

	if len(ips) == 0 {
		return
	}

	// Retrieve their OPs
	for i, post := range posts {
		post.op, err = GetPostOP(post.id)
		if err != nil {
			return
		}
		posts[i] = post
	}

	// Write ban messages to posts
	for _, post := range posts {
		err = execPrepared("ban_post", post.id)
		if err != nil {
			return
		}
		if !IsTest {
			err = common.BanPost(post.id, post.op)
			if err != nil {
				return
			}
		}
	}

	// Write bans to the ban table
	for ip, id := range ips {
		err = execPrepared("write_ban", board, ip, id, by, expires, reason)
		if err != nil {
			return
		}
	}

	_, err = db.Exec(`notify bans_updated`)
	return
}

// Lift a ban from a specific post on a specific board
func Unban(board string, id uint64, by string) error {
	return execPrepared("unban", board, id, by)
}

func loadBans() error {
	if err := RefreshBanCache(); err != nil {
		return err
	}
	return listenFunc("bans_updated", func(_ string) error {
		return RefreshBanCache()
	})
}

// RefreshBanCache loads up to date bans from the database and caches them in
// memory
func RefreshBanCache() (err error) {
	r, err := db.Query(`SELECT ip, board FROM bans`)
	if err != nil {
		return
	}
	defer r.Close()

	bans := make([]auth.Ban, 0, 16)
	for r.Next() {
		var b auth.Ban
		err = r.Scan(&b.IP, &b.Board)
		if err != nil {
			return
		}
		bans = append(bans, b)
	}
	err = r.Err()
	if err != nil {
		return
	}
	auth.SetBans(bans...)

	return nil
}

func moderatePost(
	id uint64,
	by, query string,
	propagate func(id, op uint64) error,
) (
	err error,
) {
	op, err := GetPostOP(id)
	if err != nil {
		return
	}

	if id == op && query == "delete_post" {
		query = "delete_thread"
	}

	err = execPrepared(query, id, by)
	if err != nil {
		return
	}

	err = propagate(id, op)
	return
}

func DeletePost(id uint64, by string) error {
	return moderatePost(id, by, "delete_post", common.DeletePost)
}

// GetSameIPPosts returns posts with the same IP and on the same board as the
// target post
func GetSameIPPosts(id uint64, board string) (
	posts []common.StandalonePost, err error,
) {
	// Get posts ids
	r, err := prepared["get_same_ip_posts"].Query(id, board)
	if err != nil {
		return
	}
	defer r.Close()
	var ids = make([]uint64, 0, 64)
	for r.Next() {
		var id uint64
		err = r.Scan(&id)
		if err != nil {
			return
		}
		ids = append(ids, id)
	}
	err = r.Err()
	if err != nil {
		return
	}

	// Read the matched posts
	posts = make([]common.StandalonePost, 0, len(ids))
	var post common.StandalonePost
	for _, id := range ids {
		post, err = GetPost(id)
		switch err {
		case nil:
			posts = append(posts, post)
		case sql.ErrNoRows: // Deleted in race
			err = nil
		default:
			return
		}
	}

	return
}

// Set the sticky field on a thread
func SetThreadSticky(id uint64, sticky bool) error {
	return execPrepared("set_sticky", id, sticky)
}

// GetOwnedBoards returns boards the account holder owns
func GetOwnedBoards(account string) (boards []string, err error) {
	// admin account can perform actions on any board
	if account == "admin" {
		return config.GetAllBoardIDs(), nil
	}
	r, err := prepared["get_owned_boards"].Query(account)
	if err != nil {
		return
	}
	for r.Next() {
		var board string
		err = r.Scan(&board)
		if err != nil {
			return
		}
		boards = append(boards, board)
	}
	err = r.Err()
	return
}

// Retrieve staff positions for the specificied boards.
// TODO(Kagami): Get from cache?
// TODO(Kagami): Pagination.
func GetStaff(tx *sql.Tx, boards []string) (staff auth.Staff, err error) {
	staff = make(auth.Staff, 0)
	rs, err := getStatement(tx, "get_staff").Query(pq.Array(boards))
	if err != nil {
		return
	}
	for rs.Next() {
		var rec auth.StaffRecord
		var pos string
		err = rs.Scan(&rec.Board, &rec.UserID, &pos)
		if err != nil {
			return
		}
		rec.Position.FromString(pos)
		staff = append(staff, rec)
	}
	err = rs.Err()
	return
}

// Set staff of specified board, overwriting the old values.
func WriteStaff(tx *sql.Tx, board string, staff auth.Staff) (err error) {
	if _, err = getStatement(tx, "clear_staff").Exec(board); err != nil {
		return
	}
	st := getStatement(tx, "write_staff")
	for _, rec := range staff {
		if _, err = st.Exec(board, rec.UserID, rec.Position.String()); err != nil {
			return
		}
	}
	return
}

// Get bans for the specified boards.
// TODO(Kagami): Get from cache?
// TODO(Kagami): Pagination.
func GetBans(tx *sql.Tx, boards []string) (bans auth.BanRecords, err error) {
	bans = make(auth.BanRecords, 0)
	rs, err := getStatement(tx, "get_bans").Query(pq.Array(boards))
	if err != nil {
		return
	}
	defer rs.Close()
	for rs.Next() {
		var rec auth.BanRecord
		var expires time.Time
		err = rs.Scan(&rec.Board, &rec.IP, &rec.ID, &rec.By, &expires, &rec.Reason)
		if err != nil {
			return
		}
		rec.Expires = expires.Unix()
		bans = append(bans, rec)
	}
	err = rs.Err()
	return
}

// GetBanInfo retrieves information about a specific ban
func GetBanInfo(ip, board string) (b auth.BanRecord, err error) {
	var expires time.Time
	err = prepared["get_ban_info"].
		QueryRow(ip, board).
		Scan(&b.Board, &b.IP, &b.ID, &b.Reason, &b.By, &expires)
	b.Expires = expires.Unix()
	return
}

// Set bans of specified board, overwriting the old values.
func WriteBans(tx *sql.Tx, board string, bans auth.BanRecords) (err error) {
	if _, err = getStatement(tx, "clear_bans").Exec(board); err != nil {
		return
	}
	st := getStatement(tx, "write_ban")
	for _, rec := range bans {
		expires := time.Unix(rec.Expires, 0)
		_, err = st.Exec(board, rec.IP, rec.ID, rec.By, expires, rec.Reason)
		if err != nil {
			return
		}
	}
	_, err = tx.Exec(`notify bans_updated`)
	return
}

// Retrieve moderation log for the specified boards.
// TODO(Kagami): Pagination.
func GetModLog(boards []string) (log auth.ModLogRecords, err error) {
	log = make(auth.ModLogRecords, 0)
	rs, err := prepared["get_mod_log"].Query(pq.Array(boards))
	if err != nil {
		return
	}
	defer rs.Close()
	for rs.Next() {
		var rec auth.ModLogRecord
		var created time.Time
		err = rs.Scan(&rec.Board, &rec.ID, &rec.Type, &rec.By, &created)
		if err != nil {
			return
		}
		rec.Created = created.Unix()
		log = append(log, rec)
	}
	err = rs.Err()
	return
}

// DeleteBoard deletes a board and all of its contained threads and
// posts.
func DeleteBoard(board string) error {
	_, err := prepared["delete_board"].Exec(board)
	return err
}

// Operate on multiple tables simultaneously.
// Useful for board admin.

type BoardState struct {
	Settings config.BoardConfig `json:"settings"`
	Staff    auth.Staff         `json:"staff"`
	Bans     auth.BanRecords    `json:"bans"`
}

func GetBoardState(tx *sql.Tx, board string) (state BoardState, err error) {
	conf, err := GetBoardConfig(tx, board)
	if err != nil {
		return
	}
	staff, err := GetStaff(tx, []string{board})
	if err != nil {
		return
	}
	bans, err := GetBans(tx, []string{board})
	if err != nil {
		return
	}
	state = BoardState{conf, staff, bans}
	return
}

func SetBoardState(tx *sql.Tx, state BoardState, by string) (err error) {
	if err = UpdateBoard(tx, state.Settings, by); err != nil {
		return
	}
	if err = WriteStaff(tx, state.Settings.ID, state.Staff); err != nil {
		return
	}
	if err = WriteBans(tx, state.Settings.ID, state.Bans); err != nil {
		return
	}
	return
}
