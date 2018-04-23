// API error interface and centralized collection of all errors return
// by server.
package server

import (
	"errors"
	"fmt"

	"meguca/ipc"
)

// Error returned by API. Serialized to common shape understanable by
// frontend. Can also keep error from internal subsystems which is never
// shown to the user by might be e.g. logged for debugging purposes.
// TODO(Kagami): easyjson.
type ApiError struct {
	code      int
	err       error
	hiddenErr error
}

func aerrorNew(code int, text string) ApiError {
	err := errors.New(text)
	return ApiError{code: code, err: err}
}

func aerrorFrom(code int, err error) ApiError {
	return ApiError{code: code, err: err}
}

func (ae ApiError) Hide(err error) ApiError {
	ae.hiddenErr = err
	return ae
}

func (ae ApiError) Code() int {
	// Fix if set incorrectly, to prevent panic in net/http.
	if ae.code < 100 {
		return 500
	}
	return ae.code
}

func (ae ApiError) Error() string {
	err := ae.err
	if ae.hiddenErr != nil {
		err = ae.hiddenErr
	}
	return fmt.Sprintf("%v", err)
}

func (ae ApiError) MarshalJSON() ([]byte, error) {
	err := ae.err
	// Do not leak sensitive data to users.
	if ae.Code() >= 500 {
		err = errInternal
	}
	s := fmt.Sprintf("{\"error\": \"%v\"}", err)
	return []byte(s), nil
}

// Predefined API errors.
var (
	aerrNoURL           = aerrorNew(400, "no url")
	aerrNotSupportedURL = aerrorNew(400, "url not supported")
	aerrInternal        = aerrorNew(500, "internal server error")
	aerrPowerUserOnly   = aerrorNew(403, "only for power users")
	aerrBoardOwnersOnly = aerrorNew(403, "only for board owners")
	aerrParseForm       = aerrorNew(400, "error parsing form")
	aerrParseJSON       = aerrorNew(400, "error parsing JSON")
	aerrNoFile          = aerrorNew(400, "no file provided")
	aerrBadUuid         = aerrorNew(400, "malformed UUID")
	aerrDupPreview      = aerrorNew(400, "duplicated preview")
	aerrBadPreview      = aerrorNew(400, "only JPEG previews allowed")
	aerrBadPreviewDims  = aerrorNew(400, "only square previews allowed")
	aerrNoIdol          = aerrorNew(404, "no such idol")
	aerrTooLarge        = aerrorNew(400, "file too large")
	aerrTooManyFiles    = aerrorNew(400, "too many files")
	aerrUploadRead      = aerrorNew(400, "error reading upload")
	aerrCorrupted       = aerrorNew(400, "corrupted file")
	aerrNameTaken       = aerrorNew(400, "name already taken")
	aerrTooManyIgnores  = aerrorNew(400, "too many users ignored")
	aerrDupIgnores      = aerrorNew(400, "duplicated ignores")
	aerrInvalidUserID   = aerrorNew(400, "invalid user ID")
	aerrInvalidState    = aerrorNew(400, "wrong board state")
	aerrTitleTooLong    = aerrorNew(400, "board title too long")
	aerrReasonTooLong   = aerrorNew(400, "ban reason too long")
	aerrTooManyStaff    = aerrorNew(400, "too many staff")
	aerrTooManyBans     = aerrorNew(400, "too many bans")
	aerrUnsupported     = aerrorFrom(400, ipc.ErrThumbUnsupported)
	aerrNoTracks        = aerrorFrom(400, ipc.ErrThumbTracks)
)

// Legacy errors.
// TODO(Kagami): Migrate to ApiError interface.
var (
	errInvalidBoard     = errors.New("invalid board")
	errReadOnly         = errors.New("read only board")
	errBanned           = errors.New("you are banned")
	errNoImage          = errors.New("post has no image")
	errInternal         = errors.New("internal server error")
	errNoNews           = errors.New("can't get news")
	errPageOverflow     = errors.New("page not found")
	errInvalidBoardName = errors.New("invalid board name")
	errBoardNameTaken   = errors.New("board name taken")
	errAccessDenied     = errors.New("access denied")
	errNoReason         = errors.New("no reason provided")
	errNoDuration       = errors.New("no ban duration provided")
	errNoBoardOwner     = errors.New("no board owners set")
	errInvalidCaptcha   = errors.New("invalid captcha")
	errInvalidPassword  = errors.New("invalid password")
	errUserIDTaken      = errors.New("login ID already taken")
)
