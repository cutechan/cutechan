// Various POST request handlers

package server

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"meguca/auth"
	"meguca/config"
	"meguca/db"
	"meguca/feeds"
	"meguca/websockets"
)

// Serve a single post as JSON
func servePost(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(getParam(r, "post"), 10, 64)
	if err != nil {
		text400(w, err)
		return
	}

	switch post, err := db.GetPost(id); err {
	case nil:
		ss, _ := getSession(r, post.Board)
		if !assertNotModOnly(w, post.Board, ss) {
			return
		}
		serveJSON(w, r, post)
	case sql.ErrNoRows:
		serve404(w)
	default:
		respondToJSONError(w, r, err)
	}
}

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
	if !assertBoardAPI(w, board) {
		return
	}
	if board == "all" {
		text400(w, errInvalidBoard)
		return
	}
	ss, _ := getSession(r, board)
	if !assertNotModOnlyAPI(w, board, ss) {
		return
	}
	if !assertNotReadOnlyAPI(w, board, ss) {
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
