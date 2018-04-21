// Various administration endpoints for logged in users

package server

import (
	"database/sql"
	"fmt"
	"net/http"
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

type boardActionRequest struct {
	Board string
	auth.Captcha
}

type boardConfigSettingRequest struct {
	auth.Captcha
	config.BoardConfig
}

type boardCreationRequest struct {
	auth.Captcha
	ID, Title string
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
	if !assertServeBoardAPI(w, board) {
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

// Validate length limit compliance of various fields
func validateBoardConfig(
	w http.ResponseWriter,
	conf config.BoardConfig,
) bool {
	var err error
	switch {
	case len(conf.Title) > common.MaxLenBoardTitle:
		err = errTitleTooLong
	}
	if err != nil {
		http.Error(w, fmt.Sprintf("400 %s", err), 400)
		return false
	}

	return true
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

// Determine, if the client has access rights to the configurations, and return
// them, if so
func boardConfData(w http.ResponseWriter, r *http.Request) (
	config.BoardConfig, bool,
) {
	var (
		conf  config.BoardConfig
		board = getParam(r, "board")
	)
	if _, ok := assertCanPerform(w, r, board, auth.BoardOwner); !ok {
		return conf, false
	}

	conf = config.GetBoardConfig(board)
	conf.ID = board
	if conf.ID == "" {
		serve404(w)
		return conf, false
	}

	return conf, true
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
		err = errTitleTooLong
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

	err = db.WriteStaff(tx, msg.ID, map[string][]string{
		"owners": []string{ss.UserID},
	})
	if err != nil {
		text500(w, r, err)
		return
	}
	if err := tx.Commit(); err != nil {
		text500(w, r, err)
	}
}

// Set board-specific configurations to the user's owned board
func configureBoard(w http.ResponseWriter, r *http.Request) {
	var msg boardConfigSettingRequest
	if !decodeJSON(w, r, &msg) {
		return
	}
	msg.ID = getParam(r, "board")
	_, ok := assertCanPerform(w, r, msg.ID, auth.BoardOwner)
	if !ok || !validateBoardConfig(w, msg.BoardConfig) {
		return
	}
	if err := db.UpdateBoard(msg.BoardConfig); err != nil {
		text500(w, r, err)
		return
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
	case len(msg.Reason) > common.MaxBanReasonLength:
		text400(w, errBanReasonTooLong)
		return
	case msg.Reason == "":
		text400(w, errNoReason)
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

// Assign moderation staff to a board
func assignStaff(w http.ResponseWriter, r *http.Request) {
	var msg struct {
		boardActionRequest
		Owners, Moderators, Janitors []string
	}
	if !decodeJSON(w, r, &msg) {
		return
	}
	_, ok := assertCanPerform(w, r, msg.Board, auth.BoardOwner)
	if !ok {
		return
	}
	switch {
	// Ensure there always is at least one board owner
	case len(msg.Owners) == 0:
		text400(w, errNoBoardOwner)
		return
	default:
		// Maximum of 100 staff per position
		for _, s := range [...][]string{msg.Owners, msg.Moderators, msg.Janitors} {
			if len(s) > 100 {
				text400(w, errTooManyStaff)
				return
			}
		}
	}

	// Write to database
	tx, err := db.StartTransaction()
	if err != nil {
		text500(w, r, err)
		return
	}
	defer db.RollbackOnError(tx, &err)

	err = db.WriteStaff(tx, msg.Board, map[string][]string{
		"owners":     msg.Owners,
		"moderators": msg.Moderators,
		"janitors":   msg.Janitors,
	})
	if err != nil {
		text500(w, r, err)
		return
	}

	err = tx.Commit()
	if err != nil {
		text500(w, r, err)
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

// Render list of bans on a board with unban links for authenticated staff
func banList(w http.ResponseWriter, r *http.Request) {
	board := getParam(r, "board")
	if !assertServeBoard(w, board) {
		return
	}
	ss, _ := getSession(r, board)
	if !assertNotModOnly(w, board, ss) {
		return
	}

	bans, err := db.GetBoardBans(board)
	if err != nil {
		text500(w, r, err)
		return
	}

	canUnban := canPerform(ss, auth.Moderator)
	content := []byte(templates.BanList(bans, board, canUnban))
	html := []byte(templates.BasePage(content))
	serveHTML(w, r, html, nil)
}

// Serve moderation log for a specific board
func modLog(w http.ResponseWriter, r *http.Request) {
	board := getParam(r, "board")
	if !assertServeBoard(w, board) {
		return
	}
	ss, _ := getSession(r, board)
	if !assertNotModOnly(w, board, ss) {
		return
	}

	log, err := db.GetModLog(board)
	if err != nil {
		text500(w, r, err)
		return
	}

	content := []byte(templates.ModLog(log))
	html := []byte(templates.BasePage(content))
	serveHTML(w, r, html, nil)
}

func serveAdmin(w http.ResponseWriter, r *http.Request, ss *auth.Session) {
	html := templates.Admin(ss)
	serveHTML(w, r, html, nil)
}
