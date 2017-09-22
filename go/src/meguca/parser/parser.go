// Parses and verifies user-sent post data.
package parser

import (
	"bytes"
	"database/sql"
	"meguca/common"
	"meguca/templates"
	"meguca/db"
	"strings"
	"strconv"

	b "github.com/cutechan/blackfriday"
)

type parseRenderer struct {
	links common.Links
	*b.Html
}

func (r *parseRenderer) PostLink(out *bytes.Buffer, text []byte) {
	link, err := parsePostLink(text)
	if err != nil {
		return
	}
	r.links = append(r.links, link)
}

// Collect post links.
//
// Run the full formatting process which is kinda superfluous (we don't
// need resulting markup) but should be not too expensive.
//
// That would guarantee that we will collect only links that are
// actually needed (e.g. not the ones in code blocks).
func ParseLinks(body []byte) (common.Links, error) {
	renderer := &parseRenderer{
		links: nil,
		Html:  b.HtmlRenderer(templates.HtmlFlags, "", "").(*b.Html),
	}
	b.Markdown(body, renderer, templates.Extensions)
	return renderer.links, nil
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

// ParseSubject verifies and trims a thread subject string.
func ParseSubject(s string) (string, error) {
	if s == "" {
		return s, common.ErrNoSubject
	}
	if len(s) > common.MaxLenSubject {
		return s, common.ErrSubjectTooLong
	}
	return strings.TrimSpace(s), nil
}
