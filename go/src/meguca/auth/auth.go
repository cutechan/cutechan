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
	"sync"

	"golang.org/x/crypto/bcrypt"
)

var (
	// IsReverseProxied specifies, if the server is deployed behind a reverse
	// proxy.
	IsReverseProxied bool

	// ReverseProxyIP specifies the IP of a non-localhost reverse proxy. Used
	// for filtering in XFF IP determination.
	ReverseProxyIP string

	// board: IP: IsBanned
	bans   = map[string]map[string]bool{}
	bansMu sync.RWMutex

	NullPositions = Positions{CurBoard: NotLoggedIn, AnyBoard: NotLoggedIn}
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

// IsBanned returns if the IP is banned on the target board
func IsBanned(board, ip string) (banned bool) {
	bansMu.RLock()
	defer bansMu.RUnlock()
	global := bans["all"]
	ips := bans[board]
	if global != nil && global[ip] {
		return true
	}
	if ips != nil && ips[ip] {
		return true
	}
	return false
}

// SetBans replaces the ban cache with the new set
func SetBans(b ...Ban) {
	newBans := map[string]map[string]bool{}
	for _, b := range b {
		board, ok := newBans[b.Board]
		if !ok {
			board = map[string]bool{}
			newBans[b.Board] = board
		}
		board[b.IP] = true
	}
	bansMu.Lock()
	bans = newBans
	bansMu.Unlock()
}
