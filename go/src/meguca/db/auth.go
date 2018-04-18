package db

import (
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"meguca/auth"
	"meguca/common"
	"meguca/config"
)

var (
	ErrUserNameTaken = errors.New("user name already taken")
)

// Get user's session by token.
func GetSession(board, token string) (ss *auth.Session, err error) {
	var userID string
	var userName string
	var settingsData []byte
	q := prepared["get_account_by_token"].QueryRow(token)
	err = q.Scan(&userID, &userName, &settingsData)
	if err != nil {
		if err == sql.ErrNoRows {
			err = common.ErrInvalidCreds
		}
		return
	}

	pos, err := getPositions(board, userID)
	if err != nil {
		return
	}

	var settings auth.AccountSettings
	// TODO(Kagami): easyjson.
	err = json.Unmarshal(settingsData, &settings)
	if err != nil {
		return
	}
	settings.Name = userName
	ss = &auth.Session{
		UserID:    userID,
		Token:     token,
		Positions: pos,
		Settings:  settings,
	}
	return
}

func SetAccountSettings(userID string, as auth.AccountSettings) (err error) {
	return
}

// RegisterAccount writes the ID and password hash of a new user account to the
// database
func RegisterAccount(ID string, hash []byte) error {
	err := execPrepared("register_account", ID, hash)
	if IsConflictError(err) {
		return ErrUserNameTaken
	}
	return err
}

// GetPassword retrieves the login password hash of the registered user account
func GetPassword(id string) (hash []byte, err error) {
	err = prepared["get_password"].QueryRow(id).Scan(&hash)
	return
}

// Get highest positions of specified user.
func getPositions(board, userID string) (pos auth.Positions, err error) {
	if userID == "admin" {
		pos.CurBoard = auth.Admin
		pos.AnyBoard = auth.Admin
		return
	}

	rs, err := prepared["get_positions"].Query(userID)
	if err != nil {
		return
	}
	defer rs.Close()

	var posBoard string
	var posLevel string
	for rs.Next() {
		err = rs.Scan(&posBoard, &posLevel)
		if err != nil {
			return
		}
		level := auth.NotStaff
		switch posLevel {
		case "owners":
			level = auth.BoardOwner
		case "moderators":
			level = auth.Moderator
		case "janitors":
			level = auth.Janitor
		}
		if level > pos.AnyBoard {
			pos.AnyBoard = level
		}
		// NOTE(Kagami): It's fine to pass board = "" to getPositions.
		// posBoard can't be empty so resulting CurBoard will be "notStaff"
		// which is perfectly ok.
		if posBoard == board && level > pos.CurBoard {
			pos.CurBoard = level
		}
	}
	err = rs.Err()
	return
}

// WriteLoginSession writes a new user login session to the DB
func WriteLoginSession(account, token string) error {
	expiryTime := time.Duration(common.SessionExpiry) * time.Hour * 24
	return execPrepared(
		"write_login_session",
		account,
		token,
		time.Now().Add(expiryTime),
	)
}

// LogOut logs the account out of one specific session
func LogOut(account, token string) error {
	return execPrepared("log_out", account, token)
}

// LogOutAll logs an account out of all user sessions
func LogOutAll(account string) error {
	return execPrepared("log_out_all", account)
}

// ChangePassword changes an existing user's login password
func ChangePassword(account string, hash []byte) error {
	return execPrepared("change_password", account, hash)
}

// GetOwnedBoards returns boards the account holder owns
func GetOwnedBoards(account string) (boards []string, err error) {
	// admin account can perform actions on any board
	if account == "admin" {
		return config.GetBoards(), nil
	}

	r, err := prepared["get_owned_boards"].Query(account)
	if err != nil {
		return
	}
	for r.Next() {
		var board string
		err = r.Scan(&board)
		if err != nil {
			return
		}
		boards = append(boards, board)
	}
	err = r.Err()
	return
}

// GetBanInfo retrieves information about a specific ban
func GetBanInfo(ip, board string) (b auth.BanRecord, err error) {
	err = prepared["get_ban_info"].
		QueryRow(ip, board).
		Scan(&b.IP, &b.Board, &b.ForPost, &b.Reason, &b.By, &b.Expires)
	return
}

// Get all bans on a specific board. "all" counts as a valid board value.
func GetBoardBans(board string) (b []auth.BanRecord, err error) {
	b = make([]auth.BanRecord, 0, 64)
	r, err := prepared["get_bans_by_board"].Query(board)
	if err != nil {
		return
	}
	defer r.Close()

	var rec auth.BanRecord
	for r.Next() {
		err = r.Scan(&rec.IP, &rec.ForPost, &rec.Reason, &rec.By, &rec.Expires)
		if err != nil {
			return
		}
		rec.Board = board
		b = append(b, rec)
	}
	err = r.Err()

	return
}

// GetIP returns an IP of the poster that created a post. Posts older than 7
// days will not have this information.
func GetIP(id uint64) (string, error) {
	var ip sql.NullString
	err := prepared["get_ip"].QueryRow(id).Scan(&ip)
	return ip.String, err
}
