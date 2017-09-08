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
	"meguca/websockets/feeds"
	"time"
	"unicode/utf8"
	"unsafe"
)

var (
	errPostingTooFast    = errors.New("posting too fast")
	errBadSignature      = errors.New("bad signature")
	errReadOnly          = errors.New("read only board")
	errInvalidImageToken = errors.New("invalid image token")
	errNoTextOrImage     = errors.New("no text or image")
)

// ThreadCreationRequest contains data for creating a new thread
type ThreadCreationRequest struct {
	ReplyCreationRequest
	Subject, Board string
}

// ReplyCreationRequest contains common fields for both thread and reply
// creation
type ReplyCreationRequest struct {
	Open  bool
	Image ImageRequest
	auth.Captcha
	Password, Body string
	Token, Sign    string
	Creds          *auth.SessionCreds
}

// ImageRequest contains data for allocating an image
type ImageRequest struct {
	Token string
}

// CreateThread creates a new tread and writes it to the database.
// open specifies, if the thread OP should stay open after creation.
// XXX(Kagami): Check for ModOnly is in `server/post.go`.
func CreateThread(req ThreadCreationRequest, ip string) (
	post db.Post, err error,
) {
	switch {
	case !auth.IsNonMetaBoard(req.Board):
		err = errInvalidBoard
		return
	case auth.IsBanned(req.Board, ip):
		err = errBanned
		return
	case !auth.AuthenticateCaptcha(req.Captcha):
		err = errInValidCaptcha
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

	post, err = constructPost(
		req.ReplyCreationRequest,
		ip,
		req.Board,
	)
	if err != nil {
		return
	}
	subject, err := parser.ParseSubject(req.Subject)
	if err != nil {
		return
	}

	// Perform this last, so there are less dangling images because of any error
	hasImage := req.Image.Token != ""
	if hasImage {
		var img *common.Image
		img, err = getImage(req.Image.Token)
		if err != nil {
			return
		}
		post.Files = append(post.Files, *img)
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
func CreatePost(
	op uint64,
	board, ip string,
	needCaptcha bool,
	req ReplyCreationRequest,
) (
	post db.Post, msg []byte, err error,
) {
	if auth.IsBanned(board, ip) {
		err = errBanned
		return
	}
	if needCaptcha {
		if !auth.AuthenticateCaptcha(req.Captcha) {
			err = errInValidCaptcha
			return
		} else if config.Get().Captcha {
			// Captcha solved - reset spam score.
			auth.ResetSpamScore(ip)
		}
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

	// Post must have either at least one character or an image to be allocated
	hasImage := req.Image.Token != ""
	if req.Body == "" && !hasImage {
		err = errNoTextOrImage
		return
	}

	post, err = constructPost(req, ip, board)
	if err != nil {
		return
	}

	if hasImage {
		var img *common.Image
		img, err = getImage(req.Image.Token)
		if err != nil {
			return
		}
		post.Files = append(post.Files, *img)
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

// Insert a new post into the database
// FIXME(Kagami): This is currently disabled and doesn't have a check
// for a ModOnly board.
func (c *Client) insertPost(data []byte) (err error) {
	return

	var req ReplyCreationRequest
	err = decodeMessage(data, &req)
	if err != nil {
		return
	}

	_, op, board := feeds.GetSync(c)
	post, msg, err := CreatePost(op, board, c.ip, !auth.CanPost(c.ip), req)
	if err != nil {
		return
	}

	// Ensure the client knows the post ID, before the public post insertion
	// update message is sent
	err = c.sendMessage(common.MessagePostID, post.ID)
	if err != nil {
		return
	}

	if post.Editing {
		c.post.init(post.StandalonePost)
	}
	c.feed.InsertPost(post.StandalonePost, c.post.body, msg)

	score := auth.PostCreationScore + auth.CharScore*time.Duration(c.post.len)
	if len(post.Files) > 0 {
		score += auth.ImageScore
	}
	return c.incrementSpamScore(score)
}

// Reset the IP's spam score, by submitting a captcha
func (c *Client) submitCaptcha(data []byte) (err error) {
	var msg auth.Captcha
	err = decodeMessage(data, &msg)
	if err != nil {
		return
	}

	if !auth.AuthenticateCaptcha(msg) {
		return errInValidCaptcha
	}
	auth.ResetSpamScore(c.ip)
	return nil
}

// If the client has a previous post, close it silently
// func (c *Client) closePreviousPost() error {
// 	if c.post.id != 0 {
// 		return c.closePost()
// 	}
// 	return nil
// }

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
func constructPost(
	req ReplyCreationRequest,
	ip, board string,
) (
	post db.Post, err error,
) {
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

	if req.Open {
		post.Editing = true

		// Posts that are committed in one action need not a password, as they
		// are closed on commit and can not be reclaimed
		err = parser.VerifyPostPassword(req.Password)
		if err != nil {
			return
		}
		post.Password, err = auth.BcryptHash(req.Password, 4)
		if err != nil {
			return
		}
	} else {
		post.Links, err = parser.ParseBody([]byte(req.Body), board)
		if err != nil {
			return
		}
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
