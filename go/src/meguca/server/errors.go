// API error interface and centralized collection of all errors return
// by server.
package server

import (
	"errors"
	"fmt"
)

// Error returned by API. Serialized to common shape understanable by
// frontend.
// TODO(Kagami): easyjson support?
// TODO(Kagami): Context fields?
type ApiError struct {
	code int
	err  error
}

func NewApiError(code int, text string) ApiError {
	err := errors.New(text)
	return ApiError{code, err}
}

func (ae ApiError) Code() int {
	// Fix if set incorrectly, to prevent panic in net/http.
	if ae.code < 100 {
		return 500
	}
	return ae.code
}

func (ae ApiError) MarshalJSON() ([]byte, error) {
	err := ae.err
	// Do not leak sensitive data to clients.
	if ae.Code() >= 500 {
		err = errInternal
	}
	s := fmt.Sprintf("{\"error\": \"%v\"}", err)
	return []byte(s), nil
}

// Predefined API errors.
var (
	aerrNoURL           = NewApiError(400, "no url")
	aerrNotSupportedURL = NewApiError(400, "url not supported")
	aerrInternal        = NewApiError(500, "internal server error")
	aerrModOnly         = NewApiError(403, "only for mods")
)

// Legacy errors.
// TODO(Kagami): Migrate to ApiError interface.
var (
	errInvalidBoard     = errors.New("invalid board")
	errReadOnly         = errors.New("read only board")
	errBanned           = errors.New("you are banned")
	errTooManyFiles     = errors.New("too many files")
	errNoImage          = errors.New("post has no image")
	errInternal         = errors.New("internal server error")
	errNoNews           = errors.New("can't get news")
	errPageOverflow     = errors.New("page not found")
	errTitleTooLong     = errors.New("board title too long")
	errBanReasonTooLong = errors.New("ban reason too long")
	errInvalidBoardName = errors.New("invalid board name")
	errBoardNameTaken   = errors.New("board name taken")
	errAccessDenied     = errors.New("access denied")
	errNoReason         = errors.New("no reason provided")
	errNoDuration       = errors.New("no ban duration provided")
	errNoBoardOwner     = errors.New("no board owners set")
	errTooManyStaff     = errors.New("too many staff per position")
	errInvalidCaptcha   = errors.New("invalid captcha")
	errInvalidPassword  = errors.New("invalid password")
	errInvalidUserID    = errors.New("invalid login ID")
	errUserIDTaken      = errors.New("login ID already taken")
)
