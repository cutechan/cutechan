// Parses and verifies user-sent post data.
package parser

import (
	"bytes"
	"database/sql"
	"meguca/common"
	"meguca/db"
	"meguca/templates"
	"meguca/util"
	"strings"
	"strconv"

	b "github.com/cutechan/blackfriday"
)

// Check thread subject string.
func ParseSubject(s string) (string, error) {
	if s == "" {
		return s, common.ErrNoSubject
	}
	if len(s) > common.MaxLenSubject {
		return s, common.ErrSubjectTooLong
	}
	return strings.TrimSpace(s), nil
}

type parseRenderer struct {
	links    common.Links
	commands common.Commands
	*b.Html
}

func (r *parseRenderer) PostLink(out *bytes.Buffer, text []byte) {
	link, err := parsePostLink(text)
	if err != nil {
		return
	}
	r.links = append(r.links, link)
}

// Extract post links from a text fragment, verify and retrieve their
// parenthood.
func parsePostLink(text []byte) (link [2]uint64, err error) {
	idStr := string(text[2:])
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return
	}

	op, err := db.GetPostOP(id)
	switch err {
	case nil:
		link = [2]uint64{id, op}
	case sql.ErrNoRows: // Points to invalid post. Ignore.
		err = nil
	}
	return
}

func (r *parseRenderer) Command(out *bytes.Buffer, text []byte, c, q string) {
	// Allow only single command per post for now.
	if len(r.commands) > 0 {
		return
	}

	switch c {
	case "roll":
		m := templates.RollQueryRe.FindStringSubmatch(q)
		if m != nil {
			a, _ := strconv.Atoi(m[1])
			b, _ := strconv.Atoi(m[2])
			v := util.PseudoRandInt(a, b)
			cmd := common.Command{Type: common.Roll, Roll: v}
			r.commands = append(r.commands, cmd)
		}
	case "flip":
		m := templates.FlipQueryRe.FindStringSubmatch(q)
		if m != nil {
			a, _ := strconv.Atoi(m[1])
			b := util.PseudoRandInt(1, 100)
			v := a >= b
			cmd := common.Command{Type: common.Flip, Flip: v}
			r.commands = append(r.commands, cmd)
		}
	}
}

// Extract special elements from the post body which need some
// additional processing.
//
// Run the full formatting process which is kinda superfluous (we don't
// need resulting markup) but it shouldn't be too expensive. That would
// guarantee that the parsing is correct (e.g. in case of code blocks).
func ParseBody(body []byte) (common.Links, common.Commands, error) {
	renderer := &parseRenderer{
		links:    nil,
		commands: nil,
		Html:     b.HtmlRenderer(templates.HtmlFlags, "", "").(*b.Html),
	}
	b.Markdown(body, renderer, templates.Extensions)
	return renderer.links, renderer.commands, nil
}
