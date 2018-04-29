package server

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
)

const (
	// Body size limit for POST request JSON. Should never exceed 32 KB.
	// Consider anything bigger an attack.
	jsonLimit = 1 << 15
)

// Marshal input data to JSON an write to client.
func serveJSON(w http.ResponseWriter, r *http.Request, data interface{}) {
	buf, err := json.Marshal(data)
	if err != nil {
		text500(w, r, err)
		return
	}
	head := w.Header()
	for key, val := range vanillaHeaders {
		head.Set(key, val)
	}
	if assertCached(w, r, buf) {
		return
	}
	head.Set("Content-Type", "application/json")
	writeData(w, r, buf)
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

func respondToJSONError(w http.ResponseWriter, r *http.Request, err error) {
	if err == sql.ErrNoRows {
		serve404(w, r)
	} else {
		text500(w, r, err)
	}
}

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
