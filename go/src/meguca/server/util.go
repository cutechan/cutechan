package server

import (
	"database/sql"
	"fmt"
	"log"
	"meguca/auth"
	"meguca/config"
	"meguca/db"
	"meguca/templates"
	"net/http"
	"runtime/debug"
	"strconv"

	"github.com/dimfeld/httptreemux"
)

const (
	numPostsAtIndex   = 3
	numPostsOnRequest = 100
)

var (
	// Base set of HTTP headers for both HTML and JSON
	vanillaHeaders = map[string]string{
		"Cache-Control": "no-cache, must-revalidate, max-age=0",
	}
	// Set of headers for serving images (and other uploaded files)
	imageHeaders = map[string]string{
		"Cache-Control": "max-age=31536000, public",
	}
)

// Check is any of the etags the client provides in the "If-None-Match" header
// match the generated etag. If yes, write 304 and return true.
func checkClientEtag(
	w http.ResponseWriter,
	r *http.Request,
	etag string,
) bool {
	if etag == r.Header.Get("If-None-Match") {
		w.WriteHeader(304)
		return true
	}
	return false
}

// Combine the progress counter and optional configuration hash into a weak etag
func formatEtag(ctr uint64, hash string, pos auth.ModerationLevel) string {
	buf := make([]byte, 3, 128)
	buf[0] = 'W'
	buf[1] = '/'
	buf[2] = '"'
	buf = strconv.AppendUint(buf, ctr, 10)

	addOpt := func(s string) {
		buf = append(buf, '-')
		buf = append(buf, s...)
	}
	if hash != "" {
		addOpt(hash)
	}
	if pos != auth.NotLoggedIn {
		addOpt(pos.String())
	}
	buf = append(buf, '"')

	return string(buf)
}

// Write a []byte to the client
func writeData(w http.ResponseWriter, r *http.Request, data []byte) {
	_, err := w.Write(data)
	if err != nil {
		logError(r, err)
	}
}

// Log an error together with the client's IP and stack trace
func logError(r *http.Request, err interface{}) {
	ip, err := auth.GetIP(r)
	if err != nil {
		ip = "invalid IP"
	}
	log.Printf("server: %s: %s\n%s\n", ip, err, debug.Stack())
}

// Text-only 404 response
func text404(w http.ResponseWriter) {
	http.Error(w, "404 not found", 404)
}

// Text-only 400 response
func text400(w http.ResponseWriter, err error) {
	http.Error(w, fmt.Sprintf("400 %s", err), 400)
}

func text403(w http.ResponseWriter, err error) {
	http.Error(w, fmt.Sprintf("403 %s", err), 403)
}

// Text-only 500 response
func text500(w http.ResponseWriter, r *http.Request, err interface{}) {
	http.Error(w, "500 internal server error", 500)
	logError(r, err)
}

// Check client is not banned on specific board. Returns true, if all clear.
// Renders ban page and returns false otherwise.
func assertNotBanned(
	w http.ResponseWriter,
	r *http.Request,
	board string,
) bool {
	ip, err := auth.GetIP(r)
	if err != nil {
		text400(w, err)
		return false
	}
	globally, fromBoard := auth.GetBannedLevels(board, ip)
	if !globally && !fromBoard {
		return true
	}
	if globally {
		board = "all"
	}

	rec, err := db.GetBanInfo(ip, board)
	switch err {
	case nil:
		w.WriteHeader(403)
		head := w.Header()
		for key, val := range vanillaHeaders {
			head.Set(key, val)
		}
		head.Set("Content-Type", "text/html")
		head.Set("Cache-Control", "no-store")
		content := []byte(templates.BanPage(rec))
		html := []byte(templates.BasePage(content))
		w.Write(html)
		return false
	case sql.ErrNoRows:
		// If there is no row, that means the ban cache has not been updated
		// yet with a cleared ban. Force a ban cache refresh.
		if err := db.RefreshBanCache(); err != nil {
			log.Printf("refreshing ban cache: %s", err)
		}
		return true
	default:
		text500(w, r, err)
		return false
	}
}

func checkModOnly(r *http.Request, board string) bool {
	if !config.IsModOnly(board) {
		return true
	}

	creds, err := extractLoginCreds(r)
	if err != nil {
		return false
	}

	pos, err := db.FindPosition(board, creds.UserID)
	if err != nil {
		return false
	}
	if pos < auth.Moderator {
		return false
	}

	return true
}

func assertNotModOnly(w http.ResponseWriter, r *http.Request, board string) bool {
	if !checkModOnly(r, board) {
		text404(w)
		return false
	}
	return true
}

// Extract URL paramater from request context
func extractParam(r *http.Request, id string) string {
	return httptreemux.ContextParams(r.Context())[id]
}

type SameSite int

const (
	SAMESITE_DEFAULT_MODE SameSite = iota + 1
	SAMESITE_LAX_MODE
	SAMESITE_STRICT_MODE
)

// https://github.com/golang/go/issues/15867
func SetCookie(w http.ResponseWriter, cookie *http.Cookie, sameSite SameSite) {
	if v := cookie.String(); v != "" {
		v += "; SameSite"
		switch sameSite {
		case SAMESITE_LAX_MODE:
			v += "=Lax"
		case SAMESITE_STRICT_MODE:
			v += "=Strict"
		}
		w.Header().Add("Set-Cookie", v)
	}
}
