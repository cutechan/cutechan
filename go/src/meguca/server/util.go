package server

import (
	"database/sql"
	"fmt"
	"log"
	"mime/multipart"
	"net/http"
	"net/url"
	"runtime/debug"
	"strconv"

	"meguca/auth"
	"meguca/config"
	"meguca/db"
	"meguca/templates"

	"github.com/dimfeld/httptreemux"
)

const (
	numPostsAtIndex   = 3
	numPostsOnRequest = 100
)

var (
	// Base set of HTTP headers for both HTML and JSON
	vanillaHeaders = map[string]string{
		"Cache-Control": "no-cache",
	}
	// Set of headers for serving images (and other uploaded files)
	imageHeaders = map[string]string{
		"Cache-Control": "max-age=31536000, public, immutable",
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
func formatEtag(ctr uint64, hash string, pos auth.Positions) string {
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
	if pos.CurBoard != auth.NotLoggedIn {
		addOpt(pos.CurBoard.String())
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
	log.Printf("server: %s: %s\n%s", auth.GetLogIP(r), err, debug.Stack())
}

// Text-only 400 response
// TODO(Kagami): User ApiError instead.
func text400(w http.ResponseWriter, err error) {
	http.Error(w, fmt.Sprintf("400 %s", err), 400)
}

// Text-only 403 response
// TODO(Kagami): User ApiError instead.
func text403(w http.ResponseWriter, err error) {
	http.Error(w, fmt.Sprintf("403 %s", err), 403)
}

// Text-only 500 response
// TODO(Kagami): User ApiError instead.
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

// API version of banned response.
func assertNotBannedAPI(w http.ResponseWriter, r *http.Request, board string) (ip string, ok bool) {
	ip, err := auth.GetIP(r)
	if err != nil {
		text400(w, err)
		return
	}
	if auth.IsBanned(board, ip) {
		text403(w, errBanned)
		return
	}
	ok = true
	return
}

func assertBoard(w http.ResponseWriter, r *http.Request, board string) bool {
	if !config.IsBoard(board) {
		serve404(w, r)
		return false
	}
	return true
}

func assertBoardAPI(w http.ResponseWriter, r *http.Request, board string) bool {
	if !config.IsBoard(board) {
		text400(w, errInvalidBoard)
		return false
	}
	return true
}

func assertServeBoard(w http.ResponseWriter, r *http.Request, board string) bool {
	if !config.IsServeBoard(board) {
		serve404(w, r)
		return false
	}
	return true
}

func assertServeBoardAPI(w http.ResponseWriter, r *http.Request, board string) bool {
	if !config.IsServeBoard(board) {
		text400(w, errInvalidBoard)
		return false
	}
	return true
}

func checkReadOnly(board string, ss *auth.Session) bool {
	if !config.IsReadOnlyBoard(board) {
		return true
	}
	if ss == nil {
		return false
	}
	return ss.Positions.CurBoard >= auth.Moderator
}

// Eunsure only mods and above can post at read-only boards.
func assertNotReadOnlyAPI(w http.ResponseWriter, r *http.Request, board string, ss *auth.Session) bool {
	if !checkReadOnly(board, ss) {
		text403(w, errReadOnly)
		return false
	}
	return true
}

func checkModOnly(board string, ss *auth.Session) bool {
	if !config.IsModOnlyBoard(board) {
		return true
	}
	if ss == nil {
		return false
	}
	return ss.Positions.CurBoard >= auth.Moderator
}

// Eunsure only mods and above can view mod-only boards.
func assertNotModOnly(w http.ResponseWriter, r *http.Request, board string, ss *auth.Session) bool {
	if !checkModOnly(board, ss) {
		serve404(w, r)
		return false
	}
	return true
}

// Eunsure only mods and above can post at mod-only boards.
func assertNotModOnlyAPI(w http.ResponseWriter, r *http.Request, board string, ss *auth.Session) bool {
	if !checkModOnly(board, ss) {
		text400(w, errInvalidBoard)
		return false
	}
	return true
}

func checkPowerUser(ss *auth.Session) bool {
	if ss == nil {
		return false
	}
	return auth.IsPowerUser(ss.Positions)
}

// Eunsure only power users can pass.
func assertPowerUserAPI(w http.ResponseWriter, r *http.Request, ss *auth.Session) bool {
	if !checkPowerUser(ss) {
		serveErrorJSON(w, r, aerrPowerUserOnly)
		return false
	}
	return true
}

// Deprecated: use getParam instead.
func extractParam(r *http.Request, id string) string {
	return getParam(r, id)
}

// Extract URL paramater from request context
func getParam(r *http.Request, id string) string {
	return httptreemux.ContextParams(r.Context())[id]
}

// Maximum amount of data server will deal with.
func getMaxBodySize() int64 {
	n := config.Get().MaxSize*1024*1024 + jsonLimit
	return int64(n)
}

func parseUploadForm(w http.ResponseWriter, r *http.Request) (
	f url.Values, m *multipart.Form, err error,
) {
	r.Body = http.MaxBytesReader(w, r.Body, getMaxBodySize())
	if err = r.ParseMultipartForm(0); err != nil {
		err = aerrParseForm.Hide(err)
		return
	}
	f = r.Form
	m = r.MultipartForm
	return
}
