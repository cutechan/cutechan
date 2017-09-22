// Package parser parses and verifies user-sent post data.
package parser

import (
	"database/sql"
	"meguca/common"
	"meguca/db"
	"meguca/util"
	"regexp"
	"strings"
	"strconv"
)

var linkRegexp = regexp.MustCompile(`^>{2,}(\d+)$`)

// Needed to avoid cyclic imports for the 'db' package.
func init() {
	common.ParseBody = ParseBody
}

// ParseBody parses the entire post text body for links.
func ParseBody(body []byte, board string) (links [][2]uint64, err error) {
	start := 0

	for i, b := range body {
		switch b {
		case '\n', ' ', '\t':
		default:
			if i == len(body)-1 {
				i++
			} else {
				continue
			}
		}

		_, word, _ := util.SplitPunctuation(body[start:i])
		start = i + 1
		if len(word) == 0 {
			continue
		}

		switch word[0] {
		case '>':
			m := linkRegexp.FindSubmatch(word)
			if m == nil {
				continue
			}
			var l [2]uint64
			l, err = parseLink(m)
			switch {
			case err != nil:
				return
			case l[0] != 0:
				links = append(links, l)
			}
		}
	}

	return
}

// Extract post links from a text fragment, verify and retrieve their
// parenthood.
func parseLink(match [][]byte) (link [2]uint64, err error) {
	id, err := strconv.ParseUint(string(match[1]), 10, 64)
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
