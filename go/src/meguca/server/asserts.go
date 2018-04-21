package server

import (
	"fmt"
	"net/http"

	"meguca/auth"
	"meguca/config"
	"meguca/util"
)

// Ensure API user is not banned.
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

func assertBoard(w http.ResponseWriter, board string) bool {
	if !config.IsBoard(board) {
		serve404(w)
		return false
	}
	return true
}

func assertBoardAPI(w http.ResponseWriter, board string) bool {
	if !config.IsBoard(board) {
		text400(w, errInvalidBoard)
		return false
	}
	return true
}

func assertServeBoard(w http.ResponseWriter, board string) bool {
	if !config.IsServeBoard(board) {
		serve404(w)
		return false
	}
	return true
}

func assertServeBoardAPI(w http.ResponseWriter, board string) bool {
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
func assertNotReadOnlyAPI(w http.ResponseWriter, board string, ss *auth.Session) bool {
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
func assertNotModOnly(w http.ResponseWriter, board string, ss *auth.Session) bool {
	if !checkModOnly(board, ss) {
		serve404(w)
		return false
	}
	return true
}

// Eunsure only mods and above can post at mod-only boards.
func assertNotModOnlyAPI(w http.ResponseWriter, board string, ss *auth.Session) bool {
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
func assertPowerUserAPI(w http.ResponseWriter, ss *auth.Session) bool {
	if !checkPowerUser(ss) {
		text403(w, aerrPowerUserOnly)
		return false
	}
	return true
}

// Calculate and check provided ETag by simply hashing the content.
// This doesn't make page generation faster, only saves network traffic.
func assertCached(
	w http.ResponseWriter,
	r *http.Request,
	buf []byte,
) bool {
	etag := fmt.Sprintf("W/\"%s\"", util.HashBuffer(buf))
	w.Header().Set("ETag", etag)
	if etag == r.Header.Get("If-None-Match") {
		// https://tools.ietf.org/html/rfc2616#section-10.3.5
		// https://stackoverflow.com/a/4226409
		w.WriteHeader(304)
		return true
	}
	return false
}
