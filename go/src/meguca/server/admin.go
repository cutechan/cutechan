// Various administration endpoints for logged in users

package server

import (
	"database/sql"
	"fmt"
	"net/http"
	"reflect"
	"regexp"
	"strconv"
	"time"

	"meguca/auth"
	"meguca/common"
	"meguca/config"
	"meguca/db"
	"meguca/feeds"
	"meguca/templates"
)

var (
	boardNameValidation = regexp.MustCompile(`^[a-z0-9]{1,10}$`)
	reservedBoards      = [...]string{
		"all", "stickers", "admin",
		"html", "api",
		"static", "uploads",
	}
)

type boardCreationRequest struct {
	auth.Captcha
	ID, Title string
}

type boardActionRequest struct {
	Board string
	auth.Captcha
}

// Detect, if a client can perform moderation on a board.
func canPerform(ss *auth.Session, level auth.ModerationLevel) bool {
	if ss == nil {
		return false
	}
	if ss.UserID == "admin" {
		// Admin account can do anything.
		return true
	}
	if level == auth.Admin {
		// Only admin account can perform Admin actions.
		return false
	}
	return ss.Positions.CurBoard >= level
}

// Assert user can perform a moderation action.
func assertCanPerform(
	w http.ResponseWriter,
	r *http.Request,
	board string,
	level auth.ModerationLevel,
) (ss *auth.Session, can bool) {
	if !assertBoardAPI(w, board) {
		return
	}
	ss = assertSession(w, r, board)
	if ss == nil {
		return
	}
	can = canPerform(ss, level)
	if !can {
		text403(w, errAccessDenied)
		return
	}
	return
}

// Assert client can moderate a post of unknown parenthood and return userID
func canModeratePost(
	w http.ResponseWriter,
	r *http.Request,
	id uint64,
	level auth.ModerationLevel,
) (
	board, userID string,
	can bool,
) {
	board, err := db.GetPostBoard(id)
	switch err {
	case nil:
	case sql.ErrNoRows:
		text400(w, err)
		return
	default:
		text500(w, r, err)
		return
	}

	ss, can := assertCanPerform(w, r, board, level)
	if !can {
		text403(w, errAccessDenied)
		return
	}

	userID = ss.UserID
	return
}

func isAdmin(w http.ResponseWriter, r *http.Request) bool {
	ss := assertSession(w, r, "")
	if ss == nil {
		return false
	}
	if ss.UserID != "admin" {
		text403(w, errAccessDenied)
		return false
	}
	return true
}

// Handle requests to create a board
func createBoard(w http.ResponseWriter, r *http.Request) {
	var msg boardCreationRequest
	if !decodeJSON(w, r, &msg) {
		return
	}
	ss := assertSession(w, r, "")
	if ss == nil {
		return
	}

	// Returns, if the board name, matches a reserved ID
	isReserved := func() bool {
		for _, s := range reservedBoards {
			if msg.ID == s {
				return true
			}
		}
		return false
	}

	// Validate request data
	var err error
	switch {
	case ss.UserID != "admin" && config.Get().DisableUserBoards:
		err = errAccessDenied
	case !boardNameValidation.MatchString(msg.ID),
		msg.ID == "",
		len(msg.ID) > common.MaxLenBoardID,
		isReserved():
		err = errInvalidBoardName
	case len(msg.Title) > 100:
		err = aerrTitleTooLong
	case !auth.AuthenticateCaptcha(msg.Captcha):
		err = errInvalidCaptcha
	}
	if err != nil {
		text400(w, err)
		return
	}

	tx, err := db.StartTransaction()
	if err != nil {
		text500(w, r, err)
		return
	}
	defer db.RollbackOnError(tx, &err)

	err = db.WriteBoard(tx, config.BoardConfig{
		BoardPublic: config.BoardPublic{
			ID:    msg.ID,
			Title: msg.Title,
		},
	})
	switch {
	case err == nil:
	case db.IsConflictError(err):
		text400(w, errBoardNameTaken)
		return
	default:
		text500(w, r, err)
		return
	}

	rec := auth.StaffRecord{msg.ID, ss.UserID, auth.BoardOwner}
	err = db.WriteStaff(tx, msg.ID, auth.Staff{rec})
	if err != nil {
		text500(w, r, err)
		return
	}
	if err := tx.Commit(); err != nil {
		text500(w, r, err)
	}
}

// Delete a board owned by the client
func deleteBoard(w http.ResponseWriter, r *http.Request) {
	var msg boardActionRequest
	if !decodeJSON(w, r, &msg) {
		return
	}
	_, ok := assertCanPerform(w, r, msg.Board, auth.BoardOwner)
	if !ok {
		return
	}

	if err := db.DeleteBoard(msg.Board); err != nil {
		text500(w, r, err)
	}
}

// Set the server configuration to match the one sent from the admin account
// user
func configureServer(w http.ResponseWriter, r *http.Request) {
	var msg config.ServerConfig
	if !decodeJSON(w, r, &msg) || !isAdmin(w, r) {
		return
	}
	if err := db.SetServerConfig(msg); err != nil {
		text500(w, r, err)
	}
}

// Delete one or multiple posts on a moderated board
func deletePost(w http.ResponseWriter, r *http.Request) {
	moderatePosts(w, r, auth.Moderator, db.DeletePost)
}

// Perform a moderation action an a single post. If ok == false, the caller
// should return.
func moderatePost(
	w http.ResponseWriter,
	r *http.Request,
	id uint64,
	level auth.ModerationLevel,
	fn func(userID string) error,
) (
	ok bool,
) {
	_, userID, can := canModeratePost(w, r, id, level)
	if !can {
		return
	}

	switch err := fn(userID); err {
	case nil:
		return true
	case sql.ErrNoRows:
		text400(w, err)
		return
	default:
		text500(w, r, err)
		return
	}
}

// Same as moderatePost, but works on an array of posts
func moderatePosts(
	w http.ResponseWriter,
	r *http.Request,
	level auth.ModerationLevel,
	fn func(id uint64, userID string) error,
) {
	var ids []uint64
	if !decodeJSON(w, r, &ids) {
		return
	}
	for _, id := range ids {
		ok := moderatePost(w, r, id, auth.Moderator, func(userID string) error {
			return fn(id, userID)
		})
		if !ok {
			return
		}
	}
	serveEmptyJSON(w, r)
}

// Ban a specific IP from a specific board
func ban(w http.ResponseWriter, r *http.Request) {
	var msg struct {
		Global   bool
		Duration uint64
		Reason   string
		IDs      []uint64
	}

	// Decode and validate
	if !decodeJSON(w, r, &msg) {
		return
	}
	ss := assertSession(w, r, "")
	switch {
	case ss == nil:
		return
	case msg.Global && ss.UserID != "admin":
		text403(w, errAccessDenied)
		return
	case msg.Reason == "", len(msg.Reason) > common.MaxBanReasonLength:
		text400(w, aerrInvalidReason)
		return
	case msg.Duration == 0:
		text400(w, errNoDuration)
		return
	}

	// Group posts by board
	byBoard := make(map[string][]uint64, 2)
	if msg.Global {
		byBoard["all"] = msg.IDs
	} else {
		for _, id := range msg.IDs {
			board, err := db.GetPostBoard(id)
			switch err {
			case nil:
			case sql.ErrNoRows:
				text400(w, err)
				return
			default:
				text500(w, r, err)
				return
			}

			byBoard[board] = append(byBoard[board], id)
		}

		// Assert rights to moderate for all affected boards
		for b := range byBoard {
			if _, ok := assertCanPerform(w, r, b, auth.Moderator); !ok {
				return
			}
		}
	}

	// Apply bans
	expires := time.Now().Add(time.Duration(msg.Duration) * time.Minute)
	for board, ids := range byBoard {
		ips, err := db.Ban(board, msg.Reason, ss.UserID, expires, ids...)
		if err != nil {
			text500(w, r, err)
			return
		}

		// Redirect all banned connected clients to the /all/ board
		for ip := range ips {
			for _, cl := range common.GetByIPAndBoard(ip, board) {
				cl.Redirect("all")
			}
		}
	}

	serveEmptyJSON(w, r)
}

// Unban a specific board -> banned post combination
func unban(w http.ResponseWriter, r *http.Request) {
	board := getParam(r, "board")
	ss, ok := assertCanPerform(w, r, board, auth.Moderator)
	if !ok {
		return
	}

	// Extract post IDs from form
	r.Body = http.MaxBytesReader(w, r.Body, jsonLimit)
	err := r.ParseForm()
	if err != nil {
		text400(w, err)
		return
	}
	var (
		id  uint64
		ids = make([]uint64, 0, 32)
	)
	for key, vals := range r.Form {
		if len(vals) == 0 || vals[0] != "on" {
			continue
		}
		id, err = strconv.ParseUint(key, 10, 64)
		if err != nil {
			text400(w, err)
			return
		}
		ids = append(ids, id)
	}

	// Unban posts
	for _, id := range ids {
		switch err := db.Unban(board, id, ss.UserID); err {
		case nil, sql.ErrNoRows:
		default:
			text500(w, r, err)
			return
		}
	}

	http.Redirect(w, r, fmt.Sprintf("/%s/", board), 303)
}

// Send a textual message to all connected clients
func sendNotification(w http.ResponseWriter, r *http.Request) {
	var msg string
	if !decodeJSON(w, r, &msg) || !isAdmin(w, r) {
		return
	}

	data, err := common.EncodeMessage(common.MessageNotification, msg)
	if err != nil {
		text500(w, r, err)
		return
	}
	for _, cl := range feeds.All() {
		cl.Send(data)
	}
}

// Retrieve posts with the same IP on the target board
func getSameIPPosts(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(getParam(r, "id"), 10, 64)
	if err != nil {
		text400(w, err)
		return
	}
	board, _, ok := canModeratePost(w, r, id, auth.Moderator)
	if !ok {
		return
	}

	posts, err := db.GetSameIPPosts(id, board)
	if err != nil {
		text500(w, r, err)
		return
	}
	serveJSON(w, r, posts)
}

// Set the sticky flag of a thread
func setThreadSticky(w http.ResponseWriter, r *http.Request) {
	var msg struct {
		ID     uint64
		Sticky bool
	}
	if !decodeJSON(w, r, &msg) {
		return
	}
	if _, _, ok := canModeratePost(w, r, msg.ID, auth.Moderator); !ok {
		return
	}

	switch err := db.SetThreadSticky(msg.ID, msg.Sticky); err {
	case nil:
	case sql.ErrNoRows:
		text400(w, err)
	default:
		text500(w, r, err)
	}
}

// TODO(Kagami): Use transaction?
// We will check board state consistency on board update anyway though.
func serveAdmin(
	w http.ResponseWriter,
	r *http.Request,
	ss *auth.Session,
	_ string,
) {
	boards, err := db.GetOwnedBoards(ss.UserID)
	if err != nil {
		text500(w, r, err)
		return
	}

	staff, err := db.GetStaff(nil, boards)
	if err != nil {
		text500(w, r, err)
		return
	}

	bans, err := db.GetBans(nil, boards)
	if err != nil {
		text500(w, r, err)
		return
	}

	log, err := db.GetModLog(boards)
	if err != nil {
		text500(w, r, err)
		return
	}

	cs := config.GetModBoardConfigsByID(boards)
	html := templates.Admin(ss, cs, staff, bans, log)
	serveHTML(w, r, html)
}

type configureBoardRequest struct {
	OldState db.BoardState `json:"oldState"`
	NewState db.BoardState `json:"newState"`
}

func checkBoardState(board string, state db.BoardState) (err error) {
	if state.Settings.ID != board {
		err = aerrInvalidState
		return
	}
	if len(state.Settings.Title) > common.MaxLenBoardTitle {
		err = aerrTitleTooLong
		return
	}
	if len(state.Staff) > common.MaxLenStaffList {
		err = aerrTooManyStaff
		return
	}
	for _, rec := range state.Staff {
		if rec.Board != board {
			err = aerrInvalidState
			return
		}
		if !checkUserID(rec.UserID) {
			err = aerrInvalidUserID
			return
		}
		if rec.Position < auth.Blacklisted || rec.Position > auth.BoardOwner {
			err = aerrInvalidPosition
			return
		}
	}
	if len(state.Bans) > common.MaxLenBansList {
		err = aerrTooManyBans
		return
	}
	// TODO(Kagami): Validate IP.
	for _, rec := range state.Bans {
		if rec.Board != board {
			err = aerrInvalidState
			return
		}
		if !checkUserID(rec.By) {
			err = aerrInvalidUserID
			return
		}
		if rec.Reason == "" || len(rec.Reason) > common.MaxBanReasonLength {
			err = aerrInvalidReason
			return
		}
	}
	return
}

func equalStates(oldState, newState db.BoardState) bool {
	return reflect.DeepEqual(oldState, newState)
}

func configureBoard(r *http.Request, ss *auth.Session, board string) (err error) {
	var req configureBoardRequest
	if err = readJSON(r, &req); err != nil {
		return
	}
	if err = checkBoardState(board, req.NewState); err != nil {
		return
	}

	tx, err := db.BeginTx()
	if err != nil {
		err = aerrInternal.Hide(err)
		return
	}
	defer db.EndTx(tx, &err)
	if err = db.SetRepeatableRead(tx); err != nil {
		err = aerrInternal.Hide(err)
		return
	}

	dbState, err := db.GetBoardState(tx, board)
	if err != nil {
		err = aerrInternal.Hide(err)
		return
	}
	if !equalStates(dbState, req.OldState) {
		err = aerrUnsyncState
		return
	}

	if err = db.SetBoardState(tx, req.NewState); err != nil {
		err = aerrInternal.Hide(err)
		return
	}

	return
}
