// Account and login -related message handlers

package websockets

import (
	"time"

	"github.com/bakape/meguca/auth"
	"github.com/bakape/meguca/config"
	"github.com/bakape/meguca/db"
	"github.com/bakape/meguca/types"
	"github.com/bakape/meguca/util"
	r "github.com/dancannon/gorethink"
	"golang.org/x/crypto/bcrypt"
)

const (
	minIDLength       = 3
	maxIDLength       = 20
	minPasswordLength = 6
	maxPasswordLength = 30
)

// Account registration and login response codes
type loginResponseCode uint8

const (
	loginSuccess loginResponseCode = iota
	userNameTaken
	wrongCredentials
	idTooShort
	idTooLong
	passwordTooShort
	passwordTooLong
	invalidCaptcha
)

var (
	errAlreadyLoggedIn = errInvalidMessage("already logged in")
	errNotLoggedIn     = errInvalidMessage("not logged in")
)

// Request struct for logging in to an existing or registering a new account
type loginRequest struct {
	ID       string `json:"id"`
	Password string `json:"password"`
	types.Captcha
}

type loginResponse struct {
	Code    loginResponseCode `json:"code"`
	Session string            `json:"session"`
}

type authenticationRequest struct {
	ID      string `json:"id"`
	Session string `json:"session"`
}

type passwordChangeRequest struct {
	Old string `json:"old"`
	New string `json:"new"`
	types.Captcha
}

// Register a new user account
func register(data []byte, c *Client) error {
	if c.isLoggedIn() {
		return errAlreadyLoggedIn
	}

	var req loginRequest
	if err := decodeMessage(data, &req); err != nil {
		return err
	}

	code, err := handleRegistration(req, c)
	if err != nil {
		return err
	}

	return commitLogin(code, req.ID, c)
}

// Seperated into its own function for cleanliness and testability
func handleRegistration(req loginRequest, c *Client) (
	code loginResponseCode, err error,
) {
	// Validate string lengths and captcha, if enabled
	switch {
	case len(req.ID) < minIDLength:
		code = idTooShort
	case len(req.ID) > maxIDLength:
		code = idTooLong
	}
	if code > 0 {
		return
	}
	code = checkPasswordAndCaptcha(req.Password, c.IP, req.Captcha)
	if code > 0 {
		return
	}

	hash, err := util.PasswordHash(req.ID, req.Password)
	if err != nil {
		return
	}

	// Check for collision and write to DB
	err = db.RegisterAccount(req.ID, hash)
	switch err {
	case nil:
		code = loginSuccess
	case db.ErrUserNameTaken:
		code = userNameTaken
		err = nil
	}

	return
}

// Check password length and authenticate captcha, if needed
func checkPasswordAndCaptcha(password, ip string, captcha types.Captcha) (
	code loginResponseCode,
) {
	switch {
	case len(password) < minPasswordLength:
		code = passwordTooShort
	case len(password) > maxPasswordLength:
		code = passwordTooLong
	case !authenticateCaptcha(captcha, ip):
		code = invalidCaptcha
	}
	return
}

// If login succesful, generate a session token and comit to DB. Otherwise
// simply send the response code the client.
func commitLogin(code loginResponseCode, id string, c *Client) (err error) {
	msg := loginResponse{Code: code}
	if code == loginSuccess {
		msg.Session, err = util.RandomID(40)
		if err != nil {
			return err
		}

		expiryTime := config.Get().SessionExpiry * time.Hour * 24

		session := auth.Session{
			Token:   msg.Session,
			Expires: time.Now().Add(expiryTime),
		}
		query := db.GetAccount(id).Update(map[string]r.Term{
			"sessions": r.Row.Field("sessions").Append(session),
		})
		if err := db.Write(query); err != nil {
			return err
		}

		c.sessionToken = msg.Session
		c.userID = id
	}

	return c.sendMessage(messageLogin, msg)
}

// Log in a registered user account
func login(data []byte, c *Client) error {
	if c.isLoggedIn() {
		return errAlreadyLoggedIn
	}

	var req loginRequest
	if err := decodeMessage(data, &req); err != nil {
		return err
	}

	hash, err := db.GetLoginHash(req.ID)
	if err != nil {
		if err == r.ErrEmptyResult {
			return commitLogin(wrongCredentials, req.ID, c)
		}
		return err
	}

	var code loginResponseCode
	err = util.ComparePassword(req.ID, req.Password, hash)
	switch err {
	case bcrypt.ErrMismatchedHashAndPassword:
		code = wrongCredentials
	case nil:
		code = loginSuccess
	default:
		return err
	}

	return commitLogin(code, req.ID, c)
}

// Authenticate the session token of an existing logged in user account
func authenticateSession(data []byte, c *Client) error {
	if c.isLoggedIn() {
		return errAlreadyLoggedIn
	}

	var req authenticationRequest
	if err := decodeMessage(data, &req); err != nil {
		return err
	}

	var isSession bool
	query := db.
		GetAccount(req.ID).
		Field("sessions").
		Contains(func(doc r.Term) r.Term {
			return doc.Field("token").Eq(req.Session)
		}).
		Default(false)
	if err := db.One(query, &isSession); err != nil && err != r.ErrEmptyResult {
		return err
	}

	if isSession {
		c.sessionToken = req.Session
		c.userID = req.ID
	}

	return c.sendMessage(messageAuthenticate, isSession)
}

// Log out user from session and remove the session key from the database
func logOut(_ []byte, c *Client) error {
	if !c.isLoggedIn() {
		return errNotLoggedIn
	}

	// Remove current session from user's session document
	query := db.GetAccount(c.userID).
		Update(map[string]r.Term{
			"sessions": r.Row.
				Field("sessions").
				Filter(func(s r.Term) r.Term {
					return s.Field("token").Eq(c.sessionToken).Not()
				}),
		})
	return commitLogout(query, c)
}

// Common part of both logout functions
func commitLogout(query r.Term, c *Client) error {
	c.userID = ""
	c.sessionToken = ""
	if err := db.Write(query); err != nil {
		return err
	}

	return c.sendMessage(messageLogout, true)
}

// Log out all sessions of the specific user
func logOutAll(_ []byte, c *Client) error {
	if !c.isLoggedIn() {
		return errNotLoggedIn
	}

	query := db.GetAccount(c.userID).
		Update(map[string][]string{
			"sessions": []string{},
		})
	return commitLogout(query, c)
}

// Change the account password
func changePassword(data []byte, c *Client) error {
	if !c.isLoggedIn() {
		return errNotLoggedIn
	}

	var req passwordChangeRequest
	if err := decodeMessage(data, &req); err != nil {
		return err
	}

	code := checkPasswordAndCaptcha(req.New, c.IP, req.Captcha)
	if code > 0 {
		return c.sendMessage(messageChangePassword, code)
	}

	// Get old hash
	hash, err := db.GetLoginHash(c.userID)
	if err != nil {
		return err
	}

	// Validate old password
	err = util.ComparePassword(c.userID, req.Old, hash)
	switch err {
	case nil:
	case bcrypt.ErrMismatchedHashAndPassword:
		code = wrongCredentials
	default:
		return err
	}

	// If old password matched, write new hash to DB
	if code == 0 {
		hash, err := util.PasswordHash(c.userID, req.New)
		if err != nil {
			return err
		}

		q := db.GetAccount(c.userID).
			Update(map[string][]byte{
				"password": hash,
			})
		if err := db.Write(q); err != nil {
			return err
		}
	}

	return c.sendMessage(messageChangePassword, code)
}
