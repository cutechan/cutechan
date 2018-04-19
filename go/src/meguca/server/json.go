package server

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"meguca/auth"
	"meguca/cache"
	"meguca/db"
	"meguca/util"
)

const (
	// Body size limit for POST request JSON. Should never exceed 32 KB.
	// Consider anything bigger an attack.
	jsonLimit = 1 << 15
)

func readJSON(r *http.Request, dest interface{}) (err error) {
	decoder := json.NewDecoder(io.LimitReader(r.Body, jsonLimit))
	err = decoder.Decode(dest)
	if err != nil {
		err = aerrParseJSON
	}
	return
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dest interface{}) bool {
	if err := readJSON(r, dest); err != nil {
		http.Error(w, fmt.Sprintf("400 %s", err), 400)
		return false
	}
	return true
}

// API helper. Returns standardly shaped error message.
func serveErrorJSON(w http.ResponseWriter, r *http.Request, err error) {
	// This function expects ApiError so assume any other values as bug.
	aerr := aerrInternal
	if aerrAsserted, ok := err.(ApiError); ok {
		aerr = aerrAsserted
	}
	if aerr.Code() >= 500 {
		logError(r, aerr)
	}
	buf, _ := json.Marshal(aerr)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(aerr.Code())
	writeData(w, r, buf)
}

// API helper. Server should always return valid JSON to the clients.
func serveEmptyJSON(w http.ResponseWriter, r *http.Request) {
	serveJSON(w, r, "")
}

// Marshal input data to JSON an write to client.
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

func respondToJSONError(w http.ResponseWriter, r *http.Request, err error) {
	if err == sql.ErrNoRows {
		serve404(w)
	} else {
		text500(w, r, err)
	}
}

// Confirms a the thread exists on the board and returns its ID. If an error
// occurred and the calling function should return, ok = false.
func validateThread(w http.ResponseWriter, r *http.Request) (
	ss *auth.Session,
	id uint64,
	ok bool,
) {
	b := getParam(r, "board")
	if !assertBoard(w, b) {
		return
	}
	ss, _ = getSession(r, b)
	if !assertNotModOnly(w, b, ss) {
		return
	}
	if !assertNotBanned(w, r, b) {
		return
	}

	id, err := strconv.ParseUint(getParam(r, "thread"), 10, 64)
	if err != nil {
		serve404(w)
		return
	}

	valid, err := db.ValidateOP(id, b)
	if err != nil {
		text500(w, r, err)
		return
	}
	if !valid {
		serve404(w)
		return
	}

	ok = true
	return
}

// Serves board page JSON
func boardJSON(w http.ResponseWriter, r *http.Request, catalog bool) {
	b := getParam(r, "board")
	if !assertServeBoard(w, b) {
		return
	}
	ss, _ := getSession(r, b)
	if !assertNotModOnly(w, b, ss) {
		return
	}
	if !assertNotBanned(w, r, b) {
		return
	}

	data, _, ctr, err := cache.GetJSONAndData(boardCacheArgs(r, b, catalog))
	switch err {
	case nil:
		writeJSON(w, r, formatEtag(ctr, "", auth.NullPositions), data)
	case errPageOverflow:
		serve404(w)
	default:
		text500(w, r, err)
	}
}
