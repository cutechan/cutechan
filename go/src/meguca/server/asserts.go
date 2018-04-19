package server

import (
	"database/sql"
	"log"
	"net/http"

	"meguca/auth"
	"meguca/config"
	"meguca/db"
	"meguca/templates"
)

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
