//go:generate easyjson --all --no_std_marshalers $GOFILE

// Package common contains common shared types, variables and constants
// used throughout the project.
package common

import (
	"time"
)

// ParseBody forwards parser.ParseBody to avoid cyclic imports in
// db/upkeep.
var ParseBody func([]byte, string) ([][2]uint64, error)

//easyjson:json
// Board is defined to enable marshalling optimizations and sorting by
// sticky threads.
type Board []Thread

func (b Board) Len() int {
	return len(b)
}

func (b Board) Swap(i, j int) {
	b[i], b[j] = b[j], b[i]
}

func (b Board) Less(i, j int) bool {
	// So it gets sorted with sticky threads first.
	return b[i].Sticky
}

// Thread is a transport/export wrapper that stores both the thread
// metadata, its opening post data and its contained posts. The
// composite type itself is not stored in the database.
type Thread struct {
	Abbrev    bool   `json:"abbrev,omitempty"`
	Sticky    bool   `json:"sticky,omitempty"`
	PostCtr   uint32 `json:"postCtr"`
	ImageCtr  uint32 `json:"imageCtr"`
	ReplyTime int64  `json:"replyTime"`
	BumpTime  int64  `json:"bumpTime"`
	Subject   string `json:"subject"`
	Board     string `json:"board"`
	*Post
	Posts Posts `json:"posts"`
}

// Post is a generic post exposed publically through the JSON API.
type Post struct {
	ID      uint64 `json:"id"`
	Time    int64  `json:"time"`
	Body    string `json:"body"`
	Auth    string `json:"auth,omitempty"`
	Links   Links  `json:"links,omitempty"`
	Files   Files  `json:"files,omitempty"`
}

// StandalonePost is a post view that includes the "op" and "board"
// fields, which are not exposed though Post, but are required for
// retrieving a post with unknown parenthood.
type StandalonePost struct {
	Post
	OP    uint64 `json:"op"`
	Board string `json:"board"`
}

// Posts.
type Posts []*Post

// Post links.
type Links [][2]uint64

// Post files.
type Files []*Image

// Map of all backlinks on a page.
type Backlinks map[uint64]map[uint64]uint64

// Single news entry.
// TODO(Kagami): Need to use in both templates/ and db/ and can't keep
// in db/ because of cyclic imports. Move to some better place.
type NewsEntry struct {
	Subject   string
	Body      string
	ImageName string
	Time      time.Time
}
