// Various POST request handlers

package server

import (
	"fmt"
	"meguca/auth"
	"meguca/config"
	"meguca/db"
	"meguca/feeds"
	"meguca/websockets"
	"net/http"
	"strconv"
	"strings"
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
	serveJSON(w, r, res)
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
	serveJSON(w, r, res)
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
	serveJSON(w, r, res)
}

// ok = false if failed and caller should return.
func parsePostCreationForm(w http.ResponseWriter, r *http.Request) (
	req websockets.PostCreationRequest, ok bool,
) {
	f, m, err := parseUploadForm(w, r)
	if err != nil {
		serveErrorJSON(w, r, err)
		return
	}

	fhs := m.File["files[]"]
	if len(fhs) > config.Get().MaxFiles {
		serveErrorJSON(w, r, aerrTooManyFiles)
		return
	}
	tokens := make([]string, len(fhs))
	for i, fh := range fhs {
		res, err := uploadFile(fh)
		if err != nil {
			serveErrorJSON(w, r, err)
			return
		}
		tokens[i] = res.token
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

	modOnly := config.IsModOnly(f.Get("board"))
	showBadge := f.Get("showBadge") == "on" || modOnly
	showName := f.Get("showName") == "on" || modOnly
	if showBadge || showName {
		creds, err := extractLoginCreds(r)
		if err == nil {
			req.ShowBadge = showBadge
			req.ShowName = showName
			req.Creds = creds
		}
	}

	ok = true
	return
}
