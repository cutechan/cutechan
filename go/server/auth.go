package server

import (
	"database/sql"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/cutechan/cutechan/go/auth"
	"github.com/cutechan/cutechan/go/common"
	"github.com/cutechan/cutechan/go/config"
	"github.com/cutechan/cutechan/go/db"

	"golang.org/x/crypto/bcrypt"
)

var (
	userIDRe = regexp.MustCompile(`^[-_ \p{Latin}\p{Cyrillic}\d]+$`)
)

type loginCreds struct {
	ID, Password string
	auth.Captcha
}

type passwordChangeRequest struct {
	Old, New string
	auth.Captcha
}

// Register a new user account
func register(w http.ResponseWriter, r *http.Request) {
	var req loginCreds
	isValid := decodeJSON(w, r, &req) &&
		trimUserID(&req.ID) &&
		validateUserID(w, req.ID) &&
		checkPasswordAndCaptcha(w, r, req.Password, req.Captcha)
	if !isValid {
		return
	}

	hash, err := auth.BcryptHash(req.Password, 10)
	if err != nil {
		text500(w, r, err)
	}

	// Check for collision and write to DB
	switch err := db.RegisterAccount(req.ID, hash); err {
	case nil:
	case db.ErrUserNameTaken:
		text400(w, errUserIDTaken)
		return
	default:
		text500(w, r, err)
		return
	}

	commitLogin(w, r, req.ID)
}

func checkUserID(id string) bool {
	return id != "" &&
		utf8.RuneCountInString(id) <= common.MaxLenUserID &&
		userIDRe.MatchString(id)
}

func validateUserID(w http.ResponseWriter, id string) bool {
	if !checkUserID(id) {
		text400(w, aerrInvalidUserID)
		return false
	}
	return true
}

// If login successful, generate a session token and commit to DB. Otherwise
// write error message to client.
func commitLogin(w http.ResponseWriter, r *http.Request, userID string) {
	token, err := auth.RandomID(128)
	if err != nil {
		text500(w, r, err)
		return
	}
	if err := db.WriteLoginSession(userID, token); err != nil {
		text500(w, r, err)
		return
	}

	// One hour less, so the cookie expires a bit before the DB session
	// gets deleted.
	expiry := time.Duration(common.SessionExpiry)*time.Hour*24 - time.Hour
	expires := time.Now().Add(expiry)
	sessionCookie := http.Cookie{
		Name:     "session",
		Value:    token,
		Path:     "/",
		Expires:  expires,
		Secure:   secureCookie,
		HttpOnly: true,
	}
	setSameSiteCookie(w, &sessionCookie, SAMESITE_LAX_MODE)
}

// Log into a registered user account
func login(w http.ResponseWriter, r *http.Request) {
	var req loginCreds
	switch {
	case !decodeJSON(w, r, &req):
		return
	case !trimUserID(&req.ID):
		return
	case !auth.AuthenticateCaptcha(req.Captcha):
		text403(w, errInvalidCaptcha)
		return
	}

	hash, err := db.GetPassword(req.ID)
	switch err {
	case nil:
	case sql.ErrNoRows:
		text403(w, common.ErrInvalidCreds)
		return
	default:
		text500(w, r, err)
		return
	}

	switch err := auth.BcryptCompare(req.Password, hash); err {
	case nil:
		commitLogin(w, r, req.ID)
	case bcrypt.ErrMismatchedHashAndPassword:
		text403(w, common.ErrInvalidCreds)
	default:
		text500(w, r, err)
	}
}

// Common part of both logout endpoints
func commitLogout(
	w http.ResponseWriter,
	r *http.Request,
	fn func(*http.Request, *auth.Session) error,
) {
	ss := assertSession(w, r, "")
	if ss == nil {
		return
	}
	if err := fn(r, ss); err != nil {
		text500(w, r, err)
		return
	}

	expires := time.Unix(0, 0)
	sessionCookie := http.Cookie{
		Name:     "session",
		Value:    "0",
		Path:     "/",
		Expires:  expires,
		Secure:   secureCookie,
		HttpOnly: true,
	}
	setSameSiteCookie(w, &sessionCookie, SAMESITE_LAX_MODE)
}

// Log out user from session and remove the session key from the database
func logout(w http.ResponseWriter, r *http.Request) {
	commitLogout(w, r, func(r *http.Request, ss *auth.Session) error {
		token, err := getLoginToken(r)
		if err != nil {
			return err
		}
		return db.LogOut(ss.UserID, token)
	})
}

// Log out all sessions of the specific user
func logoutAll(w http.ResponseWriter, r *http.Request) {
	commitLogout(w, r, func(r *http.Request, ss *auth.Session) error {
		return db.LogOutAll(ss.UserID)
	})
}

// Change the account password
func changePassword(w http.ResponseWriter, r *http.Request) {
	var msg passwordChangeRequest
	if !decodeJSON(w, r, &msg) {
		return
	}
	ss := assertSession(w, r, "")
	if ss == nil || !checkPasswordAndCaptcha(w, r, msg.New, msg.Captcha) {
		return
	}

	// Get old hash
	hash, err := db.GetPassword(ss.UserID)
	if err != nil {
		text500(w, r, err)
		return
	}

	// Validate old password
	switch err := auth.BcryptCompare(msg.Old, hash); err {
	case nil:
	case bcrypt.ErrMismatchedHashAndPassword:
		text403(w, common.ErrInvalidCreds)
		return
	default:
		text500(w, r, err)
		return
	}

	// Old password matched, write new hash to DB
	hash, err = auth.BcryptHash(msg.New, 10)
	if err != nil {
		text500(w, r, err)
		return
	}
	if err := db.ChangePassword(ss.UserID, hash); err != nil {
		text500(w, r, err)
	}
}

// Check password length and authenticate captcha, if needed
func checkPasswordAndCaptcha(
	w http.ResponseWriter,
	r *http.Request,
	password string,
	captcha auth.Captcha,
) bool {
	switch {
	case password == "", len(password) > common.MaxLenPassword:
		text400(w, errInvalidPassword)
		return false
	case !auth.AuthenticateCaptcha(captcha):
		text403(w, errInvalidCaptcha)
		return false
	}
	return true
}

// Trim spaces from userID. Chainable with other authenticators.
func trimUserID(id *string) bool {
	*id = strings.TrimSpace(*id)
	return true
}

func getLoginToken(r *http.Request) (string, error) {
	c, err := r.Cookie("session")
	if err != nil {
		return "", common.ErrInvalidCreds
	}
	token := c.Value
	if len(token) != common.LenSession {
		return "", common.ErrInvalidCreds
	}
	return token, nil
}

// Get request session data if any.
func getSession(r *http.Request, board string) (ss *auth.Session, err error) {
	token, err := getLoginToken(r)
	if err != nil {
		return
	}
	// Just in case, to avoid search for invalid board in DB.
	if board != "" && !config.IsBoard(board) {
		err = errInvalidBoard
		return
	}
	// FIXME(Kagami): This might be affected to timing attack.
	return db.GetSession(board, token)
}

// Assert the user login session ID is valid.
func assertSession(w http.ResponseWriter, r *http.Request, b string) *auth.Session {
	ss, err := getSession(r, b)
	switch err {
	case nil:
		// Do nothing.
	case common.ErrInvalidCreds:
		text403(w, err)
	default:
		text500(w, r, err)
	}
	return ss
}

func serverSetAccountSettings(w http.ResponseWriter, r *http.Request) {
	ss := assertSession(w, r, "")
	if ss == nil {
		return
	}
	err := setAccountSettings(r, ss)
	if err != nil {
		serveErrorJSON(w, r, err)
		return
	}
	serveEmptyJSON(w, r)
}

// FIXME(Kagami): Don't mix text/plain and application/json errors.
func setAccountSettings(r *http.Request, ss *auth.Session) (err error) {
	var as auth.AccountSettings
	if err = readJSON(r, &as); err != nil {
		return
	}
	trimUserID(&as.Name)
	if !checkUserID(as.Name) {
		return aerrInvalidUserID
	}
	if len(as.Whitelist) > common.MaxLenIgnoreList ||
		len(as.Blacklist) > common.MaxLenIgnoreList {
		return aerrTooManyIgnores
	}
	ignores := make(map[string]bool)
	for _, id := range as.Whitelist {
		// Don't bother matching against DB values. It's their problem if
		// they passed wrong user IDs.
		if !checkUserID(id) {
			return aerrInvalidUserID
		}
		if ignores[id] {
			return aerrDupIgnores
		}
		ignores[id] = true
	}
	for _, id := range as.Blacklist {
		if !checkUserID(id) {
			return aerrInvalidUserID
		}
		if ignores[id] {
			return aerrDupIgnores
		}
		ignores[id] = true
	}

	err = db.SetAccountSettings(ss.UserID, as)
	switch err {
	case nil:
		return
	case db.ErrUserNameTaken:
		return aerrNameTaken
	default:
		return aerrInternal.Hide(err)
	}
}
