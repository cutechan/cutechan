package parser

import (
	"errors"
	"strings"
	"meguca/common"
)

var (
	errNoPostPassword = errors.New("no post password")
	errNoSubject      = errors.New("no subject")
)

// ParseSubject verifies and trims a thread subject string
func ParseSubject(s string) (string, error) {
	if s == "" {
		return s, errNoSubject
	}
	if len(s) > common.MaxLenSubject {
		return s, common.ErrSubjectTooLong
	}
	return strings.TrimSpace(s), nil
}

// VerifyPostPassword verifies a post password exists does not surpass the
// maximum allowed length
func VerifyPostPassword(s string) error {
	if s == "" {
		return errNoPostPassword
	}
	if len(s) > common.MaxLenPostPassword {
		return common.ErrPostPasswordTooLong
	}
	return nil
}
