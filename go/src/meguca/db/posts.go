// Package db handles all core database interactions of the server
package db

import (
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"meguca/auth"
	"meguca/common"
	"strconv"
	"time"
)

const (
	// Clients with slow connection should be able to upload files before
	// the token expires.
	postTokenTimeout = time.Minute * 5
)

var (
	// ErrInvalidToken occurs, when trying to retrieve post or image with
	// an non-existent token. The token might have expired or the client
	// could have provided an invalid token to begin with.
	ErrInvalidToken = errors.New("invalid token")

	// Occurs when client tries to retrieve too much tokens.
	ErrTokenForbidden = errors.New("token forbidden")
)

// Post is for writing new posts to a database. It contains the Password
// field, which is never exposed publically through Post.
type Post struct {
	Deleted bool
	common.StandalonePost
	Password []byte
	IP       string
}

// Thread is a template for writing new threads to the database
type Thread struct {
	ID                  uint64
	PostCtr, ImageCtr   uint32
	ReplyTime, BumpTime int64
	Subject, Board      string
}

// For decoding and encoding the tuple arrays we store links in
type linkRow [][2]uint64

func (l *linkRow) Scan(src interface{}) error {
	switch src := src.(type) {
	case []byte:
		return l.scanBytes(src)
	case string:
		return l.scanBytes([]byte(src))
	case nil:
		*l = nil
		return nil
	default:
		return fmt.Errorf("db: cannot convert %T to [][2]uint", src)
	}
}

func (l *linkRow) scanBytes(src []byte) error {
	length := len(src)
	if length < 6 {
		return errors.New("db: source too short")
	}

	src = src[1 : length-1]

	// Determine needed size and preallocate final array
	commas := 0
	for _, b := range src {
		if b == ',' {
			commas++
		}
	}
	*l = make(linkRow, 0, (commas-1)/2+1)

	var (
		inner bool
		next  [2]uint64
		err   error
		buf   = make([]byte, 0, 16)
	)
	for _, b := range src {
		switch b {
		case '{': // New tuple
			inner = true
			buf = buf[0:0]
		case ',':
			if inner { // End of first uint
				next[0], err = strconv.ParseUint(string(buf), 10, 64)
				if err != nil {
					return err
				}
				buf = buf[0:0]
			}
		case '}': // End of tuple
			next[1], err = strconv.ParseUint(string(buf), 10, 64)
			if err != nil {
				return err
			}
			*l = append(*l, next)
		default:
			buf = append(buf, b)
		}
	}

	return nil
}

func (l linkRow) Value() (driver.Value, error) {
	n := len(l)
	if n == 0 {
		return nil, nil
	}

	b := make([]byte, 1, 16)
	b[0] = '{'
	for i, l := range l {
		if i != 0 {
			b = append(b, ',')
		}
		b = append(b, '{')
		b = strconv.AppendUint(b, l[0], 10)
		b = append(b, ',')
		b = strconv.AppendUint(b, l[1], 10)
		b = append(b, '}')
	}
	b = append(b, '}')

	return string(b), nil
}

type Command struct {
}

// For encoding and decoding hash command results
type commandRow []Command

func (c *commandRow) Scan(src interface{}) error {
	return nil
}

func (c commandRow) Value() (driver.Value, error) {
	return nil, nil
}

// ValidateOP confirms the specified thread exists on specific board
func ValidateOP(id uint64, board string) (valid bool, err error) {
	err = prepared["validate_op"].QueryRow(id, board).Scan(&valid)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return
}

// GetPostOP retrieves the parent thread ID of the passed post
func GetPostOP(id uint64) (op uint64, err error) {
	err = prepared["get_post_op"].QueryRow(id).Scan(&op)
	return
}

// Retrieve the board and OP of a post
func GetPostParenthood(id uint64) (board string, op uint64, err error) {
	err = prepared["get_post_parenthood"].QueryRow(id).Scan(&board, &op)
	return
}

// GetPostBoard retrieves the board of a post by ID
func GetPostBoard(id uint64) (board string, err error) {
	err = prepared["get_post_board"].QueryRow(id).Scan(&board)
	return
}

// PostCounter retrieves the current post counter
func PostCounter() (uint64, error) {
	return getCounter("post_counter")
}

func getCounter(queryID string, args ...interface{}) (uint64, error) {
	var c sql.NullInt64
	err := prepared[queryID].QueryRow(args...).Scan(&c)
	return uint64(c.Int64), err
}

// BoardCounter retrieves the progress counter of a board
func BoardCounter(board string) (uint64, error) {
	return getCounter("board_counter", board)
}

// AllBoardCounter retrieves the progress counter of the /all/ board
func AllBoardCounter() (uint64, error) {
	return getCounter("all_board_counter")
}

// ThreadCounter retrieves the progress counter of a thread
func ThreadCounter(id uint64) (uint64, error) {
	return getCounter("thread_counter", id)
}

// NewPostID reserves a new post ID
func NewPostID() (id uint64, err error) {
	err = prepared["new_post_id"].QueryRow().Scan(&id)
	return id, err
}

func genPostCreationArgs(p Post) []interface{} {
	// Don't store empty strings in the database. Zero value != NULL.
	var auth, ip, sha1 *string
	if p.Auth != "" {
		auth = &p.Auth
	}
	if p.IP != "" {
		ip = &p.IP
	}
	if len(p.Files) > 0 {
		sha1 = &p.Files[0].SHA1
	}
	fileCnt := len(p.Files)
	return []interface{}{
		p.ID, p.Board, p.OP, p.Time, p.Body, auth, ip, linkRow(p.Links),
		sha1, fileCnt,
	}
}

// InsertThread inserts a new thread into the database.
func InsertThread(subject string, p Post) error {
	return execPrepared("insert_thread", append(genPostCreationArgs(p), subject)...)
}

// InsertPost inserts a post into an existing thread.
func InsertPost(p Post) error {
	return execPrepared("insert_post", genPostCreationArgs(p)...)
}

// SetPostCounter sets the post counter. Should only be used in tests.
func SetPostCounter(c uint64) error {
	_, err := db.Exec(`SELECT setval('post_id', $1)`, c)
	return err
}

func NewPostToken(ip string) (token string, err error) {
	// Check if client tries to abuse.
	var can bool
	err = prepared["can_get_post_token"].QueryRow(ip).Scan(&can)
	if err != nil {
		return
	}
	if !can {
		err = ErrTokenForbidden
		return
	}

	// 120 bits of entropy (20 base64 symbols) should be enough.
	token, err = auth.RandomID(15)
	if err != nil {
		return
	}

	expires := time.Now().Add(postTokenTimeout)
	err = execPrepared("write_post_token", token, ip, expires)
	return
}

func UsePostToken(token string) (err error) {
	var dbToken string
	err = prepared["use_post_token"].QueryRow(token).Scan(&dbToken)
	switch err {
	case nil:
		if token != dbToken {
			err = ErrInvalidToken
		}
	case sql.ErrNoRows:
		err = ErrInvalidToken
	}
	return
}

func CanCreateThread(ip string) bool {
	var unix int64
	err := prepared["get_last_thread_time_by_ip"].QueryRow(ip).Scan(&unix)
	switch err {
	case nil:
	case sql.ErrNoRows:
		return true
	default:
		return false
	}

	created := time.Unix(unix, 0)
	passed := time.Since(created)
	return passed.Minutes() >= 1.0
}

func CanCreatePost(ip string) bool {
	var unix int64
	err := prepared["get_last_post_time_by_ip"].QueryRow(ip).Scan(&unix)
	switch err {
	case nil:
	case sql.ErrNoRows:
		return true
	default:
		return false
	}

	created := time.Unix(unix, 0)
	passed := time.Since(created)
	return passed.Seconds() >= 1.0
}
