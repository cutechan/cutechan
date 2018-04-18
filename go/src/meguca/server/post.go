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
	req := websockets.ThreadCreationRequest{
		PostCreationRequest: postReq,
		Subject:             subject,
	}

	post, err := websockets.CreateThread(req)
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
	thread := r.Form.Get("thread")
	op, err := strconv.ParseUint(thread, 10, 64)
	if err != nil {
		text400(w, err)
		return
	}
	ok, err = db.ValidateOP(op, req.Board)
	if err != nil {
		text500(w, r, err)
		return
	}
	if !ok {
		text400(w, fmt.Errorf("invalid thread: /%s/%d", req.Board, op))
		return
	}

	post, msg, err := websockets.CreatePost(req, op)
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

	// Board and user validation.
	board := f.Get("board")
	if !assertBoardAPI(w, r, board) {
		return
	}
	ss, _ := getSession(r, board)
	if !assertNotModOnlyAPI(w, r, board, ss) {
		return
	}
	if !assertNotReadOnlyAPI(w, r, board, ss) {
		return
	}
	var ip string
	if ip, ok = assertNotBannedAPI(w, r, board); !ok {
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

	modOnly := config.IsModOnlyBoard(board)
	req = websockets.PostCreationRequest{
		FilesRequest: websockets.FilesRequest{tokens},
		Board:        board,
		Ip:           ip,
		Body:         body,
		Token:        f.Get("token"),
		Sign:         f.Get("sign"),
		ShowBadge:    f.Get("showBadge") == "on" || modOnly,
		ShowName:     modOnly,
		Session:      ss,
	}
	ok = true
	return
}
