// Package auth determines and asserts client permissions to access and modify
// server resources.
package auth

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net"
	"net/http"
	"strings"

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
	Name     string `json:"name,omitempty"`
	ShowName bool   `json:"show_name,omitempty"`
}

func (ss *Session) GetPositions() Positions {
	if ss == nil {
		return NullPositions
	}
	return ss.Positions
}

func (ss *Session) GetSettings() AccountSettings {
	if ss == nil {
		return AccountSettings{}
	}
	return ss.Settings
}

var (
	// IsReverseProxied specifies, if the server is deployed behind a reverse
	// proxy.
	IsReverseProxied bool

	// ReverseProxyIP specifies the IP of a non-localhost reverse proxy. Used
	// for filtering in XFF IP determination.
	ReverseProxyIP string
)

// GetIP extracts the IP of a request, honouring reverse proxies, if set
func GetIP(r *http.Request) (string, error) {
	ip := getIP(r)
	if net.ParseIP(ip) == nil {
		return "", fmt.Errorf("invalid IP: %s", ip)
	}
	return ip, nil
}

// Get IP for logging, replace with placeholder on error.
// TODO(Kagami): Migrate boilerplate to use this helper.
func GetLogIP(r *http.Request) (ip string) {
	ip, err := GetIP(r)
	if err != nil {
		ip = "invalid IP"
	}
	return
}

func getIP(req *http.Request) string {
	if IsReverseProxied {
		for _, h := range [...]string{"X-Forwarded-For", "X-Real-Ip"} {
			addresses := strings.Split(req.Header.Get(h), ",")

			// March from right to left until we get a public address.
			// That will be the address right before our reverse proxy.
			for i := len(addresses) - 1; i >= 0; i-- {
				// Header can contain padding spaces
				ip := strings.TrimSpace(addresses[i])

				// Filter the reverse proxy IPs
				switch {
				case ip == ReverseProxyIP:
				case !net.ParseIP(ip).IsGlobalUnicast():
				default:
					return ip
				}
			}
		}
	}
	ip, _, err := net.SplitHostPort(req.RemoteAddr)
	if err != nil {
		return req.RemoteAddr // No port in address
	}
	return ip
}

// RandomID generates a randomID of base64 characters of desired byte length
func RandomID(length int) (string, error) {
	buf := make([]byte, length)
	_, err := rand.Read(buf)
	return base64.RawStdEncoding.EncodeToString(buf), err
}

// BcryptHash generates a bcrypt hash from the passed string
func BcryptHash(password string, rounds int) ([]byte, error) {
	return bcrypt.GenerateFromPassword([]byte(password), rounds)
}

// BcryptCompare compares a bcrypt hash with a user-supplied string
func BcryptCompare(password string, hash []byte) error {
	return bcrypt.CompareHashAndPassword(hash, []byte(password))
}
