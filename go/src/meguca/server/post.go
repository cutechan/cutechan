// Various POST request handlers

package server

import (
	"errors"
	"fmt"
	"meguca/auth"
	"meguca/config"
	"meguca/db"
	"meguca/imager"
	"meguca/websockets"
	"meguca/websockets/feeds"
	"net/http"
	"strconv"
	"strings"
)

var (
	errInvalidBoard = errors.New("invalid board")
	errReadOnly     = errors.New("read only board")
	errBanned       = errors.New("you are banned")
	errTooManyFiles = errors.New("too many files")
)

// Client should get token and solve challenge in order to post.
func createPostToken(w http.ResponseWriter, r *http.Request) {
	ip, err := auth.GetIP(r)
	if err != nil {
		text400(w, err)
		return
	}

	token, err := db.NewPostToken(ip)
	switch err {
	case nil:
	case db.ErrTokenForbidden:
		text403(w, err)
		return
	default:
		text500(w, r, err)
		return
	}

	res := map[string]string{"id": token}
	serveJSON(w, r, "", res)
}

// Create thread.
func createThread(w http.ResponseWriter, r *http.Request) {
	postReq, ok := parsePostCreationForm(w, r)
	if !ok {
		return
	}

	// Map form data to websocket thread creation request.
	subject := r.Form.Get("subject")
	board := r.Form.Get("board")
	req := websockets.ThreadCreationRequest{
		PostCreationRequest: postReq,
		Subject:             subject,
		Board:               board,
	}

	// Check board.
	if !auth.IsNonMetaBoard(board) || !checkModOnly(r, board) {
		text400(w, errInvalidBoard)
		return
	}
	if !checkReadOnly(board) {
		text403(w, errInvalidBoard)
		return
	}

	// Check IP.
	ip, err := auth.GetIP(r)
	if err != nil {
		text400(w, err)
		return
	}
	if auth.IsBanned(board, ip) {
		text403(w, errBanned)
		return
	}

	post, err := websockets.CreateThread(req, ip)
	if err != nil {
		// TODO(Kagami): Not all errors are 400.
		// TODO(Kagami): Write JSON errors instead.
		text400(w, err)
		return
	}

	res := map[string]uint64{"id": post.ID}
	serveJSON(w, r, "", res)
}

// Create post.
func createPost(w http.ResponseWriter, r *http.Request) {
	req, ok := parsePostCreationForm(w, r)
	if !ok {
		return
	}

	// Check board and thread.
	board := r.Form.Get("board")
	thread := r.Form.Get("thread")
	op, err := strconv.ParseUint(thread, 10, 64)
	if err != nil {
		text400(w, err)
		return
	}
	ok, err = db.ValidateOP(op, board)
	switch {
	case err != nil:
		text500(w, r, err)
		return
	case !ok || !checkModOnly(r, board):
		text400(w, fmt.Errorf("invalid thread: /%s/%d", board, op))
		return
	}
	if !checkReadOnly(board) {
		text403(w, errInvalidBoard)
		return
	}

	// Check IP.
	ip, err := auth.GetIP(r)
	if err != nil {
		text400(w, err)
		return
	}
	if auth.IsBanned(board, ip) {
		text403(w, errBanned)
		return
	}

	post, msg, err := websockets.CreatePost(req, ip, op, board)
	if err != nil {
		text400(w, err)
		return
	}
	feeds.InsertPostInto(post.StandalonePost, msg)

	res := map[string]uint64{"id": post.ID}
	serveJSON(w, r, "", res)
}

// ok = false if failed and caller should return.
func parsePostCreationForm(w http.ResponseWriter, r *http.Request) (
	req websockets.PostCreationRequest, ok bool,
) {
	maxSize := config.Get().MaxSize<<20 + jsonLimit
	r.Body = http.MaxBytesReader(w, r.Body, int64(maxSize))
	err := r.ParseMultipartForm(0)
	if err != nil {
		text400(w, err)
		return
	}

	f := r.Form
	m := r.MultipartForm

	fhs := m.File["files[]"]
	if len(fhs) > int(config.Get().MaxFiles) {
		text400(w, errTooManyFiles)
		return
	}
	tokens := make([]string, len(fhs))
	for i, fh := range fhs {
		var code int
		var token string
		code, token, err = imager.Upload(fh)
		if err != nil {
			imager.LogError(w, r, code, err)
			return
		}
		tokens[i] = token
	}

	// NOTE(Kagami): Browsers use CRLF newlines in form-data requests,
	// see: <https://stackoverflow.com/a/6964163>.
	// This in particular breaks links formatting, also we need to be
	// consistent with WebSocket requests and store normalized data in DB.
	body := f.Get("body")
	body = strings.Replace(body, "\r\n", "\n", -1)

	req = websockets.PostCreationRequest{
		FilesRequest: websockets.FilesRequest{tokens},
		Body:         body,
		Token:        f.Get("token"),
		Sign:         f.Get("sign"),
	}
	if f.Get("staffTitle") == "on" || config.IsModOnly(f.Get("board")) {
		creds, err := extractLoginCreds(r)
		if err == nil {
			req.Creds = creds
		}
	}

	ok = true
	return
}
