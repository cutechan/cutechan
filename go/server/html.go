package server

import (
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/cutechan/cutechan/go/auth"
	"github.com/cutechan/cutechan/go/cache"
	"github.com/cutechan/cutechan/go/common"
	"github.com/cutechan/cutechan/go/config"
	"github.com/cutechan/cutechan/go/db"
	"github.com/cutechan/cutechan/go/lang"
	"github.com/cutechan/cutechan/go/templates"
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
	html := templates.Landing(ss, lang.FromReq(r))
	serveHTML(w, r, html)
}

func serve404(w http.ResponseWriter, r *http.Request) {
	html := templates.NotFound(lang.FromReq(r))
	w.Header().Set("Content-Type", "text/html")
	w.WriteHeader(404)
	io.WriteString(w, html)
}

// Serves board HTML to regular or noscript clients
func boardHTML(w http.ResponseWriter, r *http.Request, b string, catalog bool) {
	if !assertBoard(w, r, b) {
		return
	}
	ss, _ := getSession(r, b)
	if !assertNotModOnly(w, r, b, ss) {
		return
	}

	html, data, _, err := cache.GetHTML(boardCacheArgs(r, b, catalog))
	switch err {
	case nil:
		// Do nothing.
	case errPageOverflow:
		serve404(w, r)
		return
	default:
		text500(w, r, err)
		return
	}

	var n, total int
	if !catalog {
		p := data.(boardPage)
		n = p.pageN
		total = p.pageTotal
	}
	l := lang.FromReq(r)
	boardConf := config.GetBoardConfig(b)
	title := boardConf.Title
	if b == "all" {
		title = lang.Get(l, "aggregator")
	}
	html = templates.Board(l, title, n, total, ss, catalog, html)
	serveHTML(w, r, html)
}

// Asserts a thread exists on the specific board and renders the index template
func threadHTML(w http.ResponseWriter, r *http.Request) {
	ss, id, ok := validateThread(w, r)
	if !ok {
		return
	}

	l := lang.FromReq(r)
	lastN := detectLastN(r)
	k := cache.ThreadKey(l, id, lastN)
	html, data, _, err := cache.GetHTML(k, threadCache)
	if err != nil {
		respondToJSONError(w, r, err)
		return
	}

	b := getParam(r, "board")
	title := data.(common.Thread).Subject
	html = templates.Thread(id, l, b, title, lastN != 0, ss, html)
	serveHTML(w, r, html)
}

// Execute a simple template, that accepts no arguments
func staticTemplate(
	w http.ResponseWriter,
	r *http.Request,
	fn func(string) string,
) {
	l := lang.FromReq(r)
	serveHTML(w, r, []byte(fn(l)))
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
	data := []byte(templates.ConfigureServer(lang.FromReq(r), *config.Get()))
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
		serve404(w, r)
		return
	}

	board, op, err := db.GetPostParenthood(id)
	switch err {
	case nil:
		// Don't allow cross-redirects to mod-only boards.
		// TODO(Kagami): We shouldn't make links to mod-only clickable?
		if !assertNotModOnly(w, r, board, nil) {
			return
		}
		url := r.URL
		url.Path = fmt.Sprintf("/%s/%d", board, op)
		http.Redirect(w, r, url.String(), 301)
	case sql.ErrNoRows:
		serve404(w, r)
	default:
		text500(w, r, err)
	}
}

func serveStickers(w http.ResponseWriter, r *http.Request) {
	ss, _ := getSession(r, "")
	stickHTML := []byte{}
	html := templates.Stickers(ss, lang.FromReq(r), stickHTML)
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
	if !assertBoard(w, r, b) {
		return
	}
	ss, _ = getSession(r, b)
	if !assertNotModOnly(w, r, b, ss) {
		return
	}

	id, err := strconv.ParseUint(getParam(r, "thread"), 10, 64)
	if err != nil {
		serve404(w, r)
		return
	}

	valid, err := db.ValidateOP(id, b)
	if err != nil {
		text500(w, r, err)
		return
	}
	if !valid {
		serve404(w, r)
		return
	}

	ok = true
	return
}
