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

type fileScanner struct {
	APNG, Audio, Video                sql.NullBool
	FileType, ThumbType, Length, Size sql.NullInt64
	Name, SHA1, MD5, Title, Artist    sql.NullString
	Dims                              pq.Int64Array
}

func (i *fileScanner) ScanArgs() []interface{} {
	return []interface{}{
		&i.APNG, &i.Audio, &i.Video, &i.FileType, &i.ThumbType, &i.Dims,
		&i.Length, &i.Size, &i.MD5, &i.SHA1, &i.Title, &i.Artist,
	}
}

func (i *fileScanner) Val() *common.Image {
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

func scanCatalog(r tableScanner) (b common.Board, err error) {
	defer r.Close()
	b = make(common.Board, 0, 32)
	for r.Next() {
		var t common.Thread
		t, err = scanCatalogThread(r)
		if err != nil {
			return
		}
		b = append(b, t)
	}
	err = r.Err()
	return
}

// Thread with one post and image (if any) attached.
func scanCatalogThread(r rowScanner) (t common.Thread, err error) {
	var (
		ts threadScanner
		ps postScanner
		fs fileScanner
	)
	args := make([]interface{}, 0)
	args = append(args, ts.ScanArgs()...)
	args = append(args, ps.ScanArgs()...)
	args = append(args, fs.ScanArgs()...)

	err = r.Scan(args...)
	if err != nil {
		return
	}

	t = ts.Val()
	p := ps.Val()
	t.Post = &p
	img := fs.Val()
	if img != nil {
		t.Files = append(t.Files, img)
	}
	return
}

// Just a thread with post attached.
func scanThread(r rowScanner) (t common.Thread, err error) {
	var (
		ts threadScanner
		ps postScanner
	)
	args := append(ts.ScanArgs(), ps.ScanArgs()...)

	err = r.Scan(args...)
	if err != nil {
		return
	}

	t = ts.Val()
	p := ps.Val()
	t.Post = &p
	return
}

func scanImage(r rowScanner) (img common.ImageCommon, err error) {
	var fs fileScanner
	err = r.Scan(fs.ScanArgs()...)
	if err != nil {
		return
	}
	img = fs.Val().ImageCommon
	return
}

func scanThreadIDs(r tableScanner) (ids []uint64, err error) {
	defer r.Close()
	ids = make([]uint64, 0, 64)
	for r.Next() {
		var id uint64
		err = r.Scan(&id)
		if err != nil {
			return
		}
		ids = append(ids, id)
	}
	err = r.Err()
	return
}

// PostStats contains post open status, body and creation time.
type PostStats struct {
	ID   uint64
	Time int64
	Body []byte
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

// GetThread retrieves public thread data from the database.
func GetThread(id uint64, lastN int) (t common.Thread, err error) {
	// Read all data in single transaction.
	tx, err := StartTransaction()
	if err != nil {
		return
	}
	defer tx.Rollback()
	err = setReadOnly(tx)
	if err != nil {
		return
	}

	// Get thread info and OP post.
	t, err = scanThread(tx.Stmt(prepared["get_thread"]).QueryRow(id))
	if err != nil {
		return
	}

	// Partial thread routines.
	t.Abbrev = lastN != 0
	postCnt := int(t.PostCtr)
	var limit *int
	if lastN != 0 {
		postCnt = lastN
		limit = &lastN
	}

	// Get thread posts.
	r, err := tx.Stmt(prepared["get_thread_posts"]).Query(id, limit)
	if err != nil {
		return
	}
	defer r.Close()

	// Fill thread posts.
	var ps postScanner
	args := ps.ScanArgs()
	t.Posts = make([]*common.Post, 0, postCnt)
	postIds := make([]uint64, 1, postCnt + 1)  // + OP
	postIds[0] = id
	postsById := make(map[uint64]*common.Post, postCnt + 1)  // + OP
	postsById[t.ID] = t.Post
	for r.Next() {
		err = r.Scan(args...)
		if err != nil {
			return
		}
		p := ps.Val()
		t.Posts = append(t.Posts, &p)
		postIds = append(postIds, p.ID)
		postsById[p.ID] = &p
	}
	err = r.Err()
	if err != nil {
		return
	}

	// Get thread files.
	var r2 *sql.Rows
	if lastN == 0 {
		r2, err = tx.Stmt(prepared["get_thread_files"]).Query(id)
	} else {
		ids := pq.Array(postIds)
		r2, err = tx.Stmt(prepared["get_abbrev_thread_files"]).Query(ids)
	}
	if err != nil {
		return
	}
	defer r2.Close()

	// Fill posts files.
	var fs fileScanner
	var pID uint64
	args = append([]interface{}{&pID}, fs.ScanArgs()...)
	for r2.Next() {
		err = r2.Scan(args...)
		if err != nil {
			return
		}
		img := fs.Val()
		if p, ok := postsById[pID]; ok {
			p.Files = append(p.Files, img)
		}
	}
	err = r2.Err()
	return
}

// GetPost reads a single post from the database.
func GetPost(id uint64) (p common.StandalonePost, err error) {
	// Read all data in single transaction.
	tx, err := StartTransaction()
	if err != nil {
		return
	}
	defer tx.Rollback()
	err = setReadOnly(tx)
	if err != nil {
		return
	}

	// Get post.
	var ps postScanner
	args := append(ps.ScanArgs(), &p.OP, &p.Board)
	err = tx.Stmt(prepared["get_post"]).QueryRow(id).Scan(args...)
	if err != nil {
		return
	}
	p.Post = ps.Val()

	// Get post files.
	r, err := tx.Stmt(prepared["get_post_files"]).Query(id)
	if err != nil {
		return
	}
	defer r.Close()

	// Fill post files.
	var fs fileScanner
	args = fs.ScanArgs()
	for r.Next() {
		err = r.Scan(args...)
		if err != nil {
			return
		}
		img := fs.Val()
		p.Files = append(p.Files, img)
	}
	err = r.Err()
	return
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
