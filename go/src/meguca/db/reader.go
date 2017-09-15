package db

import (
	"database/sql"
	"meguca/common"

	"github.com/lib/pq"
)

type threadScanner struct {
	common.Thread
}

func (t *threadScanner) ScanArgs() []interface{} {
	return []interface{}{
		&t.Sticky, &t.Board,
		&t.PostCtr, &t.ImageCtr,
		&t.ReplyTime, &t.BumpTime,
		&t.Subject,
	}
}

func (t *threadScanner) Val() common.Thread {
	return t.Thread
}

type postScanner struct {
	common.Post
	auth  sql.NullString
	links linkRow
}

func (p *postScanner) ScanArgs() []interface{} {
	return []interface{}{&p.ID, &p.Time, &p.Body, &p.auth, &p.links}
}

func (p *postScanner) Val() common.Post {
	p.Auth = p.auth.String
	p.Links = [][2]uint64(p.links)
	return p.Post
}

type imageScanner struct {
	APNG, Audio, Video                sql.NullBool
	FileType, ThumbType, Length, Size sql.NullInt64
	Name, SHA1, MD5, Title, Artist    sql.NullString
	Dims                              pq.Int64Array
}

func (i *imageScanner) ScanArgs() []interface{} {
	return []interface{}{
		&i.APNG, &i.Audio, &i.Video, &i.FileType, &i.ThumbType, &i.Dims,
		&i.Length, &i.Size, &i.MD5, &i.SHA1, &i.Title, &i.Artist,
	}
}

func (i *imageScanner) Val() *common.Image {
	if !i.SHA1.Valid {
		return nil
	}

	var dims [4]uint16
	for j := range dims {
		dims[j] = uint16(i.Dims[j])
	}

	return &common.Image{
		ImageCommon: common.ImageCommon{
			APNG:      i.APNG.Bool,
			Audio:     i.Audio.Bool,
			Video:     i.Video.Bool,
			FileType:  uint8(i.FileType.Int64),
			ThumbType: uint8(i.ThumbType.Int64),
			Length:    uint32(i.Length.Int64),
			Dims:      dims,
			Size:      int(i.Size.Int64),
			MD5:       i.MD5.String,
			SHA1:      i.SHA1.String,
			Title:     i.Title.String,
			Artist:    i.Artist.String,
		},
	}
}

func scanThread(r rowScanner) (t common.Thread, err error) {
	var (
		ts threadScanner
		ps postScanner
		is imageScanner
	)

	args := make([]interface{}, 0)
	args = append(args, ts.ScanArgs()...)
	args = append(args, ps.ScanArgs()...)
	args = append(args, is.ScanArgs()...)
	err = r.Scan(args...)
	if err != nil {
		return
	}

	t = ts.Val()
	t.Post, err = scanPost(ps, is)
	return
}

func scanPost(ps postScanner, is imageScanner) (p common.Post, err error) {
	p = ps.Val()
	img := is.Val()
	if img != nil {
		p.Files = append(p.Files, *img)
	}
	return
}

func scanCatalog(table tableScanner) (board common.Board, err error) {
	defer table.Close()
	board = make(common.Board, 0, 32)

	var t common.Thread
	for table.Next() {
		t, err = scanThread(table)
		if err != nil {
			return
		}
		board = append(board, t)
	}
	err = table.Err()
	return
}

func scanThreadIDs(table tableScanner) (ids []uint64, err error) {
	defer table.Close()

	ids = make([]uint64, 0, 64)
	var id uint64
	for table.Next() {
		err = table.Scan(&id)
		if err != nil {
			return
		}
		ids = append(ids, id)
	}
	err = table.Err()
	return
}

// PostStats contains post open status, body and creation time.
type PostStats struct {
	ID   uint64
	Time int64
	Body []byte
}

// GetThread retrieves public thread data from the database.
func GetThread(id uint64, lastN int) (t common.Thread, err error) {
	tx, err := db.Begin()
	if err != nil {
		return
	}
	defer tx.Commit()
	err = setReadOnly(tx)
	if err != nil {
		return
	}

	// Get thread metadata and OP
	t, err = scanThread(tx.Stmt(prepared["get_thread"]).QueryRow(id))
	if err != nil {
		return
	}
	t.Abbrev = lastN != 0

	// Get replies
	var (
		cap   int
		limit *int
	)
	if lastN != 0 {
		cap = lastN
		limit = &lastN
	} else {
		cap = int(t.PostCtr)
	}
	r, err := tx.Stmt(prepared["get_thread_posts"]).Query(id, limit)
	if err != nil {
		return
	}
	defer r.Close()

	// Scan replies into []common.Post
	var (
		ps postScanner
		is imageScanner
		p  common.Post
		args = append(ps.ScanArgs(), is.ScanArgs()...)
	)
	t.Posts = make([]common.Post, 0, cap)
	for r.Next() {
		err = r.Scan(args...)
		if err != nil {
			return
		}
		p, err = scanPost(ps, is)
		if err != nil {
			return
		}
		t.Posts = append(t.Posts, p)
	}
	err = r.Err()
	return
}

// GetPost reads a single post from the database.
func GetPost(id uint64) (p common.StandalonePost, err error) {
	var (
		args = make([]interface{}, 2, 28)
		ps postScanner
		is imageScanner
	)
	args[0] = &p.OP
	args[1] = &p.Board
	args = append(args, ps.ScanArgs()...)
	args = append(args, is.ScanArgs()...)

	err = prepared["get_post"].QueryRow(id).Scan(args...)
	if err != nil {
		return
	}
	p.Post = ps.Val()
	img := is.Val()
	if img != nil {
		p.Files = append(p.Files, *img)
	}
	return
}

// GetAllBoardCatalog retrieves all OPs for the "/all/" meta-board.
func GetAllBoardCatalog() (common.Board, error) {
	r, err := prepared["get_all_board"].Query()
	if err != nil {
		return nil, err
	}
	return scanCatalog(r)
}

// GetBoardCatalog retrieves all OPs of a single board.
func GetBoardCatalog(board string) (common.Board, error) {
	r, err := prepared["get_board"].Query(board)
	if err != nil {
		return nil, err
	}
	return scanCatalog(r)
}

// Retrieves all threads IDs in bump order with stickies first.
func GetAllThreadsIDs() ([]uint64, error) {
	r, err := prepared["get_all_thread_ids"].Query()
	if err != nil {
		return nil, err
	}
	return scanThreadIDs(r)
}

// Retrieves threads IDs on the board.
func GetThreadIDs(board string) ([]uint64, error) {
	r, err := prepared["get_board_thread_ids"].Query(board)
	if err != nil {
		return nil, err
	}
	return scanThreadIDs(r)
}

// GetRecentPosts retrieves recent posts created in the thread.
func GetRecentPosts(op uint64) (posts []PostStats, err error) {
	r, err := prepared["get_recent_posts"].Query(op)
	if err != nil {
		return
	}
	defer r.Close()

	posts = make([]PostStats, 0, 64)
	var p PostStats
	for r.Next() {
		err = r.Scan(&p.ID, &p.Time)
		if err != nil {
			return
		}
		posts = append(posts, p)
	}
	err = r.Err()
	return
}

// Retrieve latest news.
func GetNews() (news []common.NewsEntry, err error) {
	r, err := prepared["get_news"].Query()
	if err != nil {
		return
	}
	defer r.Close()

	news = make([]common.NewsEntry, 0, 5)
	var entry common.NewsEntry
	for r.Next() {
		err = r.Scan(&entry.Subject, &entry.Body, &entry.ImageName, &entry.Time)
		if err != nil {
			return
		}
		news = append(news, entry)
	}
	err = r.Err()
	return
}
