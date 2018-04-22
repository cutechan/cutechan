package auth

import (
	"sync"
	"time"
)

var (
	// board: IP: IsBanned
	bans   = map[string]map[string]bool{}
	bansMu sync.RWMutex

	NullPositions = Positions{CurBoard: NotLoggedIn, AnyBoard: NotLoggedIn}
)

// ModerationLevel defines the level required to perform an action
type ModerationLevel int8

// All available moderation levels
const (
	NotLoggedIn ModerationLevel = iota - 1
	NotStaff
	Janitor
	Moderator
	BoardOwner
	Admin
)

type Positions struct {
	CurBoard ModerationLevel `json:"curBoard"`
	AnyBoard ModerationLevel `json:"anyBoard"`
}

// Reads moderation level from string representation
func (l *ModerationLevel) FromString(s string) {
	switch s {
	case "admin":
		*l = Admin
	case "owners":
		*l = BoardOwner
	case "moderators":
		*l = Moderator
	case "janitors":
		*l = Janitor
	default:
		*l = NotStaff
	}
}

// Returns string representation of moderation level
func (l ModerationLevel) String() string {
	switch l {
	case Admin:
		return "admin"
	case BoardOwner:
		return "owners"
	case Moderator:
		return "moderators"
	case Janitor:
		return "janitors"
	default:
		return ""
	}
}

func IsPowerUser(pos Positions) bool {
	return pos.AnyBoard >= Janitor
}

// An action performable by moderation staff
type ModerationAction uint8

// All supported moderation actions
const (
	BanPost ModerationAction = iota
	UnbanPost
	DeletePost
	DeleteImage
	SpoilerImage
	DeleteThread
)

// Ban holdsan entry of an IP being banned from a board
type Ban struct {
	IP, Board string
}

// BanRecord stores information about a specific ban
type BanRecord struct {
	Ban
	ForPost    uint64
	Reason, By string
	Expires    time.Time
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
