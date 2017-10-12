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

// Extract special elements from the post body which need some
// additional processing.
//
// Run the full formatting process which is kinda superfluous (we don't
// need resulting markup) but it shouldn't be too expensive. That would
// guarantee that the parsing is correct (e.g. in case of code blocks).
func ParseBody(body []byte) (common.Links, error) {
	renderer := &parseRenderer{
		links: nil,
		Html:  b.HtmlRenderer(templates.HtmlFlags, "", "").(*b.Html),
	}
	b.Markdown(body, renderer, templates.Extensions)
	return renderer.links, nil
}
