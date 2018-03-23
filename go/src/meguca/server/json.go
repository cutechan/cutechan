package server

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"meguca/auth"
	"meguca/cache"
	"meguca/db"
	"meguca/util"
	"net/http"
	"strconv"
)

// Request to spoiler an already allocated image that the sender has created
type spoilerRequest struct {
	ID       uint64
	Password string
}

// API helper. Returns standardly shaped error message.
// TODO(Kagami): Consistent naming.
func serveErrorJSON(w http.ResponseWriter, r *http.Request, err error) {
	// This function expects ApiError so assume any other values as bug.
	aerr := aerrInternal
	if aerrAsserted, ok := err.(ApiError); ok {
		aerr = aerrAsserted
	}
	buf, _ := json.Marshal(aerr)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(aerr.Code())
	writeData(w, r, buf)
}

// API helper. Server should always return valid JSON to the clients.
// TODO(Kagami): Remove.
func serveEmptyJSON(w http.ResponseWriter, r *http.Request) {
	res := map[string]int{}
	serveJSON(w, r, res)
}

// Marshal input data to JSON an write to client.
// TODO(Kagami): Consistent naming.
func serveJSON(w http.ResponseWriter, r *http.Request, data interface{}) {
	buf, err := json.Marshal(data)
	if err != nil {
		text500(w, r, err)
		return
	}
	writeJSON(w, r, "", buf)
}

// Write data as JSON to the client. If etag is "" generate a strong etag by
// hashing the resulting buffer and perform a check against the "If-None-Match"
// header. If etag is set, assume this check has already been done.
// TODO(Kagami): Consistent naming.
func writeJSON(
	w http.ResponseWriter,
	r *http.Request,
	etag string,
	buf []byte,
) {
	if etag == "" {
		etag = fmt.Sprintf("\"%s\"", util.HashBuffer(buf))
	}
	if checkClientEtag(w, r, etag) {
		return
	}

	head := w.Header()
	for key, val := range vanillaHeaders {
		head.Set(key, val)
	}
	head.Set("ETag", etag)
	head.Set("Content-Type", "application/json")

	writeData(w, r, buf)
}

// Validate the client's last N posts to display setting. To allow for
// better caching the only valid values are 3 and 100. 3 is for
// index-like thread previews and 100 is for short threads.
func detectLastN(r *http.Request) int {
	if q := r.URL.Query().Get("last"); q != "" {
		n, err := strconv.Atoi(q)
		if err == nil && (n == numPostsAtIndex || n == numPostsOnRequest) {
			return n
		}
	}
	return 0
}

// Serve a single post as JSON
func servePost(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(extractParam(r, "post"), 10, 64)
	if err != nil {
		text400(w, err)
		return
	}

	switch post, err := db.GetPost(id); err {
	case nil:
		if !assertNotModOnly(w, r, post.Board) {
			return
		}
		serveJSON(w, r, post)
	case sql.ErrNoRows:
		serve404(w, r)
	default:
		respondToJSONError(w, r, err)
	}
}

func respondToJSONError(w http.ResponseWriter, r *http.Request, err error) {
	if err == sql.ErrNoRows {
		serve404(w, r)
	} else {
		text500(w, r, err)
	}
}

// Confirms a the thread exists on the board and returns its ID. If an error
// occurred and the calling function should return, ok = false.
func validateThread(w http.ResponseWriter, r *http.Request) (uint64, bool) {
	board := extractParam(r, "board")

	if !assertNotModOnly(w, r, board) {
		return 0, false
	}
	if !assertNotBanned(w, r, board) {
		return 0, false
	}

	id, err := strconv.ParseUint(extractParam(r, "thread"), 10, 64)
	if err != nil {
		serve404(w, r)
		return 0, false
	}

	valid, err := db.ValidateOP(id, board)
	if err != nil {
		text500(w, r, err)
		return 0, false
	}
	if !valid {
		serve404(w, r)
		return 0, false
	}

	return id, true
}

// Serves board page JSON
func boardJSON(w http.ResponseWriter, r *http.Request, catalog bool) {
	b := extractParam(r, "board")
	if !auth.IsBoard(b) {
		serve404(w, r)
		return
	}
	if !assertNotModOnly(w, r, b) {
		return
	}
	if !assertNotBanned(w, r, b) {
		return
	}

	data, _, ctr, err := cache.GetJSONAndData(boardCacheArgs(r, b, catalog))
	switch err {
	case nil:
		writeJSON(w, r, formatEtag(ctr, "", auth.NotLoggedIn), data)
	case errPageOverflow:
		serve404(w, r)
	default:
		text500(w, r, err)
	}
}
