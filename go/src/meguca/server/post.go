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
	errInvalidBoard  = errors.New("invalid board")
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

// Create a thread with a closed OP
func createThread(w http.ResponseWriter, r *http.Request) {
	postReq, ok := parsePostCreationForm(w, r)
	if !ok {
		return
	}

	// Map form data to websocket thread creation request
	req := websockets.ThreadCreationRequest{
		Subject:             r.Form.Get("subject"),
		Board:               r.Form.Get("board"),
		PostCreationRequest: postReq,
	}

	ip, err := auth.GetIP(r)
	if err != nil {
		text400(w, err)
		return
	}
	if !checkModOnly(r, r.Form.Get("board")) {
		text400(w, errInvalidBoard)
		return
	}
	post, err := websockets.CreateThread(req, ip)
	if err != nil {
		// TODO(Kagami): Write JSON errors instead.
		text400(w, err)
		return
	}

	res := map[string]uint64{"id": post.ID}
	serveJSON(w, r, "", res)
}

// Create a closed reply post
func createPost(w http.ResponseWriter, r *http.Request) {
	req, ok := parsePostCreationForm(w, r)
	if !ok {
		return
	}

	// Validate thread
	op, err := strconv.ParseUint(r.Form.Get("thread"), 10, 64)
	if err != nil {
		text400(w, err)
		return
	}
	board := r.Form.Get("board")
	ok, err = db.ValidateOP(op, board)
	switch {
	case err != nil:
		text500(w, r, err)
		return
	case !ok || !checkModOnly(r, board):
		text400(w, fmt.Errorf("invalid thread: /%s/%d", board, op))
		return
	}

	ip, err := auth.GetIP(r)
	if err != nil {
		text400(w, err)
		return
	}
	post, msg, err := websockets.CreatePost(op, board, ip, req)
	if err != nil {
		text400(w, err)
		return
	}
	feeds.InsertPostInto(post.StandalonePost, msg)

	res := map[string]uint64{"id": post.ID}
	serveJSON(w, r, "", res)
}

// ok = false, if failed and caller should return
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

	tokens := make([]string, 0)
	for _, fh := range m.File["files[]"] {
		var code int
		var token string
		code, token, err = imager.Upload(fh)
		if err != nil {
			imager.LogError(w, r, code, err)
			return
		}
		tokens = append(tokens, token)
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
