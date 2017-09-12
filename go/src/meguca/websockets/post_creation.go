package websockets

// #include "stdlib.h"
// #include "post_creation.h"
import "C"

import (
	"errors"
	"meguca/auth"
	"meguca/common"
	"meguca/config"
	"meguca/db"
	"meguca/parser"
	"time"
	"unicode/utf8"
	"unsafe"
)

var (
	errPostingTooFast    = errors.New("posting too fast")
	errBadSignature      = errors.New("bad signature")
	errReadOnly          = errors.New("read only board")
	errInvalidImageToken = errors.New("invalid image token")
	errNoTextOrFiles     = errors.New("no text or files")
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

// CreateThread creates a new tread and writes it to the database.
// open specifies, if the thread OP should stay open after creation.
// XXX(Kagami): Check for ModOnly is in `server/post.go`.
func CreateThread(req ThreadCreationRequest, ip string) (
	post db.Post, err error,
) {
	if !auth.IsNonMetaBoard(req.Board) {
		err = errInvalidBoard
		return
	}

	if auth.IsBanned(req.Board, ip) {
		err = errBanned
		return
	}

	_, err = getBoardConfig(req.Board)
	if err != nil {
		return
	}

	can := db.CanCreateThread(ip)
	if !can {
		err = errPostingTooFast
		return
	}

	// Post must have either at least one character or an file to be allocated
	if req.Body == "" && len(req.FilesRequest.Tokens) == 0 {
		err = errNoTextOrFiles
		return
	}

	post, err = constructPost(req.PostCreationRequest, ip, req.Board)
	if err != nil {
		return
	}

	subject, err := parser.ParseSubject(req.Subject)
	if err != nil {
		return
	}

	// Perform this last, so there are less dangling images because of any error
	err = setPostFiles(&post, req.FilesRequest)
	if err != nil {
		return
	}

	post.ID, err = db.NewPostID()
	if err != nil {
		return
	}
	post.OP = post.ID

	err = db.InsertThread(subject, post)
	return
}

// CreatePost creates a new post and writes it to the database.
// open specifies, if the post should stay open after creation.
// XXX(Kagami): Check for ModOnly is in `server/post.go`.
func CreatePost(op uint64, board, ip string, req PostCreationRequest) (
	post db.Post, msg []byte, err error,
) {
	if auth.IsBanned(board, ip) {
		err = errBanned
		return
	}

	_, err = getBoardConfig(board)
	if err != nil {
		return
	}

	can := db.CanCreatePost(ip)
	if !can {
		err = errPostingTooFast
		return
	}

	if req.Body == "" && len(req.FilesRequest.Tokens) == 0 {
		err = errNoTextOrFiles
		return
	}

	post, err = constructPost(req, ip, board)
	if err != nil {
		return
	}

	err = setPostFiles(&post, req.FilesRequest)
	if err != nil {
		return
	}

	post.OP = op
	post.ID, err = db.NewPostID()
	if err != nil {
		return
	}

	msg, err = common.EncodeMessage(common.MessageInsertPost, post.Post)
	if err != nil {
		return
	}

	err = db.InsertPost(post, false)
	return
}

// Retrieve post-related board configurations
func getBoardConfig(board string) (conf config.BoardConfigs, err error) {
	conf = config.GetBoardConfigs(board).BoardConfigs
	if conf.ReadOnly {
		err = errReadOnly
	}
	return
}

// Check post signature
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

// Construct the common parts of the new post for both threads and replies
func constructPost(req PostCreationRequest, ip, board string) (post db.Post, err error) {
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
	// TODO(Kagami): Rollback token on failure to allow to cache it?
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

	lines := 0
	for _, r := range req.Body {
		if r == '\n' {
			lines++
		}
	}
	if lines > common.MaxLinesBody {
		err = errTooManyLines
		return
	}

	// Attach staff position title after validations
	if req.Creds != nil {
		var pos auth.ModerationLevel
		pos, err = db.FindPosition(board, req.Creds.UserID)
		if err != nil {
			return
		}
		post.Auth = pos.String()
	}

	post.Links, err = parser.ParseBody([]byte(req.Body), board)
	return
}

func setPostFiles(post *db.Post, freq FilesRequest) (err error) {
	for _, token := range freq.Tokens {
		var img *common.Image
		img, err = getImage(token)
		if err != nil {
			return
		}
		post.Files = append(post.Files, *img)
	}
	return
}

// Performs some validations and retrieves processed image data by token ID.
func getImage(token string) (img *common.Image, err error) {
	imgCommon, err := db.UseImageToken(token)
	switch err {
	case nil:
	case db.ErrInvalidToken:
		return nil, errInvalidImageToken
	default:
		return nil, err
	}

	return &common.Image{
		ImageCommon: imgCommon,
	}, nil
}
