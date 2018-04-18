package auth

import (
	"golang.org/x/crypto/bcrypt"
)

// Contains user data and settings of the request's session.
type Session struct {
	UserID    string
	Token     string
	Positions Positions
	Settings  AccountSettings
}

type AccountSettings struct {
	Name     string `json:"name"`
	ShowName bool   `json:"show_name"`
}

// BcryptCompare compares a bcrypt hash with a user-supplied string
func BcryptCompare(password string, hash []byte) error {
	return bcrypt.CompareHashAndPassword(hash, []byte(password))
}
