// Various POST request handlers

package server

import (
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

// Create a thread with a closed OP
func createThread(w http.ResponseWriter, r *http.Request) {
	repReq, ok := parsePostCreationForm(w, r)
	if !ok {
		return
	}

	// Map form data to websocket thread creation request
	req := websockets.ThreadCreationRequest{
		Subject:              r.Form.Get("subject"),
		Board:                r.Form.Get("board"),
		ReplyCreationRequest: repReq,
	}

	ip, err := auth.GetIP(r)
	if err != nil {
		text400(w, err)
		return
	}
	post, err := websockets.CreateThread(req, ip)
	if err != nil {
		// TODO(Kagami): Write JSON errors instead.
		text400(w, err)
		return
	}

	res := websockets.ThreadCreationResponse{ID: post.ID}
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
	case !ok:
		text400(w, fmt.Errorf("invalid thread: /%s/%d", board, op))
		return
	}

	ip, err := auth.GetIP(r)
	if err != nil {
		text400(w, err)
		return
	}
	post, msg, err := websockets.CreatePost(op, board, ip, true, req)
	if err != nil {
		text400(w, err)
		return
	}
	feeds.InsertPostInto(post.StandalonePost, msg)

	res := websockets.PostCreationResponse{ID: post.ID}
	serveJSON(w, r, "", res)
}

// ok = false, if failed and caller should return
func parsePostCreationForm(w http.ResponseWriter, r *http.Request) (
	req websockets.ReplyCreationRequest, ok bool,
) {
	maxSize := config.Get().MaxSize<<20 + jsonLimit
	r.Body = http.MaxBytesReader(w, r.Body, int64(maxSize))
	err := r.ParseMultipartForm(0)
	if err != nil {
		text400(w, err)
		return
	}

	// Handle image, if any, and extract file name
	var token string
	_, _, err = r.FormFile("files[]")
	switch err {
	case nil:
		var code int
		code, token, err = imager.ParseUpload(r)
		if err != nil {
			imager.LogError(w, r, code, err)
			return
		}
	case http.ErrMissingFile:
		err = nil
	default:
		text500(w, r, err)
		return
	}

	f := r.Form

	// NOTE(Kagami): Browsers use CRLF newlines in form-data requests,
	// see: <https://stackoverflow.com/a/6964163>.
	// This in particular breaks links formatting, also we need to be
	// consistent with WebSocket requests and store normalized data in DB.
	body := f.Get("body")
	body = strings.Replace(body, "\r\n", "\n", -1)

	req = websockets.ReplyCreationRequest{
		Body: body,
		Sign: f.Get("sign"),
		Captcha: auth.Captcha{
			CaptchaID: f.Get("captchaID"),
			Solution:  f.Get("captcha"),
		},
	}
	if f.Get("staffTitle") == "on" {
		req.SessionCreds = extractLoginCreds(r)
	}
	if token != "" {
		req.Image = websockets.ImageRequest{
			Token:   token,
		}
	}

	ok = true
	return
}
