// FIXME(Kagami): Move to server package.

package websockets

// #include "stdlib.h"
// #include "post_creation.h"
import "C"

import (
	"database/sql"
	"errors"
	"meguca/auth"
	"meguca/common"
	"meguca/db"
	"meguca/parser"
	"strings"
	"time"
	"unicode/utf8"
	"unsafe"
)

var (
	errPostingTooFast    = errors.New("posting too fast")
	errBadSignature      = errors.New("bad signature")
	errInvalidImageToken = errors.New("invalid image token")
	errNoTextOrFiles     = errors.New("no text or files")
	errTooManyLines      = errors.New("too many lines in post body")
)

// ThreadCreationRequest contains data for creating a new thread.
type ThreadCreationRequest struct {
	PostCreationRequest
	Subject, Board string
}

// PostCreationRequest contains common fields for both thread and post
// creation.
type PostCreationRequest struct {
	FilesRequest FilesRequest
	Body         string
	Token        string
	Sign         string
	Creds        *auth.SessionCreds
}

type FilesRequest struct {
	Tokens []string
}

// CreateThread creates a new thread and writes it to the database.
func CreateThread(req ThreadCreationRequest, ip string) (
	post db.Post, err error,
) {
	ok := db.CanCreateThread(ip)
	if !ok {
		err = errPostingTooFast
		return
	}

	tx, err := db.StartTransaction()
	if err != nil {
		return
	}
	defer db.RollbackOnError(tx, &err)

	subject, err := parser.ParseSubject(req.Subject)
	if err != nil {
		return
	}

	post, err = constructPost(tx, req.PostCreationRequest, ip, req.Board)
	if err != nil {
		return
	}

	post.ID, err = db.NewPostID(tx)
	if err != nil {
		return
	}
	post.OP = post.ID

	err = db.InsertThread(tx, post, subject)
	if err != nil {
		return
	}

	err = tx.Commit()
	return
}

// CreatePost creates a new post and writes it to the database.
func CreatePost(req PostCreationRequest, ip string, op uint64, board string) (
	post db.Post, msg []byte, err error,
) {
	ok := db.CanCreatePost(ip)
	if !ok {
		err = errPostingTooFast
		return
	}

	tx, err := db.StartTransaction()
	if err != nil {
		return
	}
	defer db.RollbackOnError(tx, &err)

	post, err = constructPost(tx, req, ip, board)
	if err != nil {
		return
	}

	post.ID, err = db.NewPostID(tx)
	if err != nil {
		return
	}
	post.OP = op

	msg, err = common.EncodeMessage(common.MessageInsertPost, post.Post)
	if err != nil {
		return
	}

	err = db.InsertPost(tx, post)
	if err != nil {
		return
	}

	err = tx.Commit()
	return
}

// Construct the common parts of the new post.
func constructPost(tx *sql.Tx, req PostCreationRequest, ip, board string) (
	post db.Post, err error,
) {
	if req.Body == "" && len(req.FilesRequest.Tokens) == 0 {
		err = errNoTextOrFiles
		return
	}

	post = db.Post{
		StandalonePost: common.StandalonePost{
			Post: common.Post{
				Time: time.Now().Unix(),
				Body: req.Body,
			},
			Board: board,
		},
		IP: ip,
	}

	// Check token and its signature.
	err = db.UsePostToken(req.Token)
	if err != nil {
		return
	}
	if !checkSign(req.Token, req.Sign) {
		err = errBadSignature
		return
	}

	if utf8.RuneCountInString(req.Body) > common.MaxLenBody {
		err = common.ErrBodyTooLong
		return
	}

	if strings.Count(req.Body, "\n") > common.MaxLinesBody {
		err = errTooManyLines
		return
	}

	// Attach staff position title after validation.
	if req.Creds != nil {
		var pos auth.Positions
		pos, err = db.GetPositions(board, req.Creds.UserID)
		if err != nil {
			return
		}
		if pos.CurBoard > auth.NotStaff {
			post.Auth = pos.CurBoard.String()
		}
	}

	post.Links, post.Commands, err = parser.ParseBody([]byte(req.Body))
	if err != nil {
		return
	}

	err = setPostFiles(tx, &post, req.FilesRequest)
	return
}

// Check post signature.
func checkSign(token, sign string) bool {
	if len(token) != 20 || len(sign) > 100 {
		return false
	}
	cToken := C.CString(token)
	cSign := C.CString(sign)
	defer C.free(unsafe.Pointer(cSign))
	defer C.free(unsafe.Pointer(cToken))
	return C.check_sign(cToken, cSign) >= 0
}

func setPostFiles(tx *sql.Tx, post *db.Post, freq FilesRequest) (err error) {
	for _, token := range freq.Tokens {
		var img *common.Image
		img, err = getImage(tx, token)
		if err != nil {
			return
		}
		post.Files = append(post.Files, img)
	}
	return
}

func getImage(tx *sql.Tx, token string) (img *common.Image, err error) {
	imgCommon, err := db.UseImageToken(tx, token)
	switch err {
	case nil:
	case db.ErrInvalidToken:
		err = errInvalidImageToken
		return
	default:
		return
	}
	img = &common.Image{ImageCommon: imgCommon}
	return
}
