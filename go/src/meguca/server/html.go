package server

import (
	"database/sql"
	"fmt"
	"io"
	"meguca/auth"
	"meguca/cache"
	"meguca/common"
	"meguca/config"
	"meguca/db"
	"meguca/templates"
	"net/http"
	"strconv"
)

// Apply headers and write HTML to client
func serveHTML(w http.ResponseWriter, r *http.Request, buf []byte) {
	head := w.Header()
	for key, val := range vanillaHeaders {
		head.Set(key, val)
	}
	if assertCached(w, r, buf) {
		return
	}
	head.Set("Content-Type", "text/html")
	writeData(w, r, buf)
}

func serveLanding(w http.ResponseWriter, r *http.Request) {
	ss, _ := getSession(r, "")
	html := templates.Landing(ss)
	serveHTML(w, r, html)
}

func serve404(w http.ResponseWriter) {
	html := templates.NotFound()
	w.Header().Set("Content-Type", "text/html")
	w.WriteHeader(404)
	io.WriteString(w, html)
}

// Helper in case if another signature required.
func serve404wr(w http.ResponseWriter, r *http.Request) {
	serve404(w)
}

// Serves board HTML to regular or noscript clients
func boardHTML(w http.ResponseWriter, r *http.Request, b string, catalog bool) {
	if !assertBoard(w, b) {
		return
	}
	ss, _ := getSession(r, b)
	if !assertNotModOnly(w, b, ss) {
		return
	}

	html, data, _, err := cache.GetHTML(boardCacheArgs(r, b, catalog))
	switch err {
	case nil:
		// Do nothing.
	case errPageOverflow:
		serve404(w)
		return
	default:
		text500(w, r, err)
		return
	}

	var n, total int
	if !catalog {
		p := data.(pageStore)
		n = p.pageNumber
		total = p.pageTotal
	}
	html = templates.Board(b, n, total, ss, catalog, html)
	serveHTML(w, r, html)
}

// Asserts a thread exists on the specific board and renders the index template
func threadHTML(w http.ResponseWriter, r *http.Request) {
	ss, id, ok := validateThread(w, r)
	if !ok {
		return
	}

	lastN := detectLastN(r)
	k := cache.ThreadKey(id, lastN)
	html, data, _, err := cache.GetHTML(k, threadCache)
	if err != nil {
		respondToJSONError(w, r, err)
		return
	}

	b := getParam(r, "board")
	title := data.(common.Thread).Subject
	html = templates.Thread(id, b, title, lastN != 0, ss, html)
	serveHTML(w, r, html)
}

// Execute a simple template, that accepts no arguments
func staticTemplate(
	w http.ResponseWriter,
	r *http.Request,
	fn func() string,
) {
	serveHTML(w, r, []byte(fn()))
}

// Renders a form for creating new boards
func boardCreationForm(w http.ResponseWriter, r *http.Request) {
	staticTemplate(w, r, templates.CreateBoard)
}

// Render the form for configuring the server
func serverConfigurationForm(w http.ResponseWriter, r *http.Request) {
	if !isAdmin(w, r) {
		return
	}
	data := []byte(templates.ConfigureServer((*config.Get())))
	serveHTML(w, r, data)
}

// Render a form to change an account password
func changePasswordForm(w http.ResponseWriter, r *http.Request) {
	staticTemplate(w, r, templates.ChangePassword)
}

// Redirect the client to the appropriate board through a cross-board redirect
func crossRedirect(w http.ResponseWriter, r *http.Request) {
	idStr := getParam(r, "id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		serve404(w)
		return
	}

	board, op, err := db.GetPostParenthood(id)
	switch err {
	case nil:
		// Don't allow cross-redirects to mod-only boards.
		// TODO(Kagami): We shouldn't make links to mod-only clickable?
		if !assertNotModOnly(w, board, nil) {
			return
		}
		url := r.URL
		url.Path = fmt.Sprintf("/%s/%d", board, op)
		http.Redirect(w, r, url.String(), 301)
	case sql.ErrNoRows:
		serve404(w)
	default:
		text500(w, r, err)
	}
}

func serveStickers(w http.ResponseWriter, r *http.Request) {
	ss, _ := getSession(r, "")
	stickHTML := []byte{}
	html := templates.Stickers(ss, stickHTML)
	serveHTML(w, r, html)
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
