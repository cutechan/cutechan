//go:generate easyjson $GOFILE

package auth

import (
	"time"
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

func (pos Positions) IsPowerUser() bool {
	return pos.AnyBoard >= Janitor
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

// An action performable by moderation staff
type ModerationAction uint8

// All supported moderation actions
// NOTE(Kagami): This is represented as number is DB, so add new items
// to the end, don't remove!
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

type IgnoreMode int

const (
	IgnoreDisabled IgnoreMode = iota - 1
	IgnoreByBlacklist
	IgnoreByWhitelist
)

// Contains user data and settings of the request's session.
//easyjson:json
type Session struct {
	UserID    string          `json:"userID"`
	Positions Positions       `json:"positions"`
	Settings  AccountSettings `json:"settings"`
}

//easyjson:json
type AccountSettings struct {
	Name        string     `json:"name,omitempty"`
	ShowName    bool       `json:"showName,omitempty"`
	IgnoreMode  IgnoreMode `json:"ignoreMode,omitempty"`
	IncludeAnon bool       `json:"includeAnon,omitempty"`
	Whitelist   []string   `json:"whitelist,omitempty"`
	Blacklist   []string   `json:"blacklist,omitempty"`
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

func (ss *Session) TryMarshal() []byte {
	if ss == nil {
		return []byte("null")
	}
	data, err := ss.MarshalJSON()
	if err != nil {
		return []byte("null")
	}
	return data
}

// Single entry in the moderation log
type ModLogEntry struct {
	Board   string           `json:"board"`
	ID      uint64           `json:"id"`
	Type    ModerationAction `json:"type"`
	By      string           `json:"by"`
	Created int64            `json:"created"`
}

//easyjson:json
type ModLogEntries []ModLogEntry

func (l *ModLogEntries) TryMarshal() []byte {
	data, err := l.MarshalJSON()
	if err != nil {
		return []byte("null")
	}
	return data
}
