// Template structs, helper routines and context providers.
// MUST BE KEPT IN SYNC WITH ts/templates/isomorph.ts!
package templates

import (
	"encoding/base64"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"meguca/assets"
	"meguca/auth"
	"meguca/common"
	"meguca/config"
	"meguca/lang"

	"github.com/valyala/quicktemplate"
)

type PostContext struct {
	Lang      string
	ID        uint64
	TID       uint64
	Index     bool
	OP        bool
	HasBoard  bool
	Board     string
	Subject   string
	Badge     bool
	Auth      string
	Name      string
	Time      string
	HasFiles  bool
	post      *common.Post
	backlinks common.Backlinks
}

type FileContext struct {
	SHA1       string
	HasTitle   bool
	LCopy      string
	Title      string
	HasVideo   bool
	HasAudio   bool
	HasLength  bool
	Length     string
	Record     bool
	Size       string
	TWidth     uint16
	THeight    uint16
	Width      uint16
	Height     uint16
	SourcePath string
	ThumbPath  string
}

type PostLinkContext struct {
	ID    string
	URL   string
	Cross bool
}

type BacklinksContext struct {
	LReplies  string
	Backlinks []string
}

func MakePostContext(l string, t common.Thread, p *common.Post, bls common.Backlinks, index bool, all bool) PostContext {
	ln := lang.Get(l)
	postTime := time.Unix(p.Time, 0)
	return PostContext{
		Lang:      l,
		ID:        p.ID,
		TID:       t.ID,
		Index:     index,
		OP:        t.ID == p.ID,
		HasBoard:  t.ID == p.ID && index && all,
		Board:     t.Board,
		Subject:   t.Subject,
		Badge:     p.Auth != "",
		Auth:      ln.Common.Posts[p.Auth],
		Name:      p.UserName,
		Time:      readableTime(l, postTime),
		HasFiles:  len(p.Files) > 0,
		post:      p,
		backlinks: bls,
	}
}

func (ctx PostContext) Render() string {
	return renderMustache("post", &ctx)
}

func (ctx *PostContext) PostClass() string {
	classes := []string{"post"}
	if ctx.OP {
		classes = append(classes, "post_op")
	}
	if len(ctx.post.Files) > 0 {
		classes = append(classes, "post_file")
		if len(ctx.post.Files) > 1 {
			classes = append(classes, "post_files")
		}
	}
	for _, pattern := range BodyEmbeds {
		if pattern.MatchString(ctx.post.Body) {
			classes = append(classes, "post_embed")
			break
		}
	}
	if ctx.post.UserID == "" {
		classes = append(classes, getByAnonCls())
	} else {
		classes = append(classes, getByIDCls(ctx.post.UserID))
	}
	return strings.Join(classes, " ")
}

func (ctx *PostContext) URL() (url string) {
	if !ctx.OP {
		url = fmt.Sprintf("#%d", ctx.ID)
	}
	if ctx.Index {
		url = fmt.Sprintf("/%s/%d%s", ctx.Board, ctx.TID, url)
	}
	return
}

// Stringify an int and left-pad to at least double digits.
func pad(buf []byte, i int) []byte {
	if i < 10 {
		buf = append(buf, '0')
	}
	return append(buf, strconv.Itoa(i)...)
}

func readableTime(l string, t time.Time) string {
	ln := lang.Get(l).Common.Time
	year, m, day := t.Date()
	weekday := ln["week"][int(t.Weekday())]
	// Months are 1-indexed for some fucking reason.
	month := ln["calendar"][int(m)-1]

	// Premature optimization.
	buf := make([]byte, 0, 17+len(weekday)+len(month))
	buf = pad(buf, day)
	buf = append(buf, ' ')
	buf = append(buf, month...)
	buf = append(buf, ' ')
	buf = append(buf, strconv.Itoa(year)...)
	buf = append(buf, " ("...)
	buf = append(buf, weekday...)
	buf = append(buf, ") "...)
	buf = pad(buf, t.Hour())
	buf = append(buf, ':')
	buf = pad(buf, t.Minute())

	return string(buf)
}

func duration(l uint32) string {
	return fmt.Sprintf("%02d:%02d", l/60, l%60)
}

// Formats a human-readable representation of file size.
func fileSize(l string, size int) string {
	sizes := lang.Get(l).Common.Sizes
	switch {
	case size < 1024:
		return fmt.Sprintf("%d%s", size, sizes["b"])
	case size < 1024*1024:
		return fmt.Sprintf("%.2f%s", float32(size)/1024, sizes["kb"])
	default:
		return fmt.Sprintf("%.2f%s", float32(size)/1024/1024, sizes["mb"])
	}
}

func (ctx *PostContext) Files() (files []string) {
	if len(ctx.post.Files) == 0 {
		return
	}
	for _, img := range ctx.post.Files {
		files = append(files, renderFile(ctx.Lang, img))
	}
	return
}

func renderFile(l string, img *common.Image) string {
	ln := lang.Get(l)
	fileCtx := FileContext{
		SHA1:       img.SHA1,
		HasTitle:   img.Title != "",
		LCopy:      ln.Common.Posts["clickToCopy"],
		Title:      img.Title,
		HasVideo:   img.Video,
		HasAudio:   img.Audio,
		HasLength:  img.Video || img.Audio,
		Length:     duration(img.Length),
		Record:     img.Audio && !img.Video,
		Size:       fileSize(l, img.Size),
		Width:      img.Dims[0],
		Height:     img.Dims[1],
		TWidth:     img.Dims[2],
		THeight:    img.Dims[3],
		SourcePath: assets.SourcePath(img.FileType, img.SHA1),
		ThumbPath:  assets.ThumbPath(img.ThumbType, img.SHA1),
	}
	return renderMustache("post-file", &fileCtx)
}

func (ctx *PostContext) Body() string {
	return renderBody(ctx.post, ctx.TID, ctx.Index)
}

// Render a link to another post. Can optionally be cross-thread.
func renderPostLink(id uint64, cross, index bool) string {
	idStr := strconv.FormatUint(id, 10)
	url := ""
	if cross || index {
		url += "/all/" + idStr
	}
	url += "#" + idStr
	linkCtx := PostLinkContext{
		ID:    idStr,
		URL:   url,
		Cross: cross,
	}
	return renderMustache("post-link", &linkCtx)
}

func (ctx *PostContext) Backlinks() string {
	links := ctx.backlinks[ctx.ID]
	if links == nil {
		return ""
	}

	// Backlink ids always grow.
	ids := make(sortableUInt64, len(links))
	i := 0
	for id := range links {
		ids[i] = id
		i++
	}
	sort.Sort(ids)

	rendered := make([]string, len(links))
	for i, id := range ids {
		op := links[id]
		rendered[i] = renderPostLink(id, op != ctx.TID, ctx.Index)
	}

	linkCtx := BacklinksContext{
		LReplies:  lang.GT(ctx.Lang, "replies"),
		Backlinks: rendered,
	}
	return renderMustache("post-backlinks", &linkCtx)
}

func getPluralFormIndex(langCode string, n int) int {
	switch langCode {
	case "ru":
		if n%10 == 1 && n%100 != 11 {
			return 0
		} else if n%10 >= 2 && n%10 <= 4 && (n%100 < 10 || n%100 >= 20) {
			return 1
		} else {
			return 2
		}
	default:
		if n == 1 {
			return 0
		} else {
			return 1
		}
	}
}

// Return either the singular or plural form of a translation, depending on
// number
func pluralize(num int, plurals []string) string {
	langCode := config.Get().DefaultLang
	return plurals[getPluralFormIndex(langCode, num)]
}

// Return pluar form for two numbers.
func pluralize2(n1, n2 int, plurals []string) string {
	if n1+n2 == 1 {
		return plurals[0]
	} else {
		return plurals[1]
	}
}

func getByAnonCls() string {
	return "post_by-anon"
}

func getByIDCls(id string) string {
	src := []byte(id)
	s := base64.RawStdEncoding.EncodeToString(src)
	return "post_by-" + s
}

func getByAnonSel() string {
	return ".post_by-anon"
}

func getByIDSel(id string) string {
	src := []byte(id)
	s := base64.RawStdEncoding.EncodeToString(src)
	// https://mathiasbynens.be/notes/css-escapes
	s = strings.Replace(s, "+", "\\+", -1)
	s = strings.Replace(s, "/", "\\/", -1)
	return ".post_by-" + s
}

func streamgenerateIgnoreCSS(qw *quicktemplate.Writer, ss *auth.Session) {
	if ss == nil {
		return
	}
	as := ss.Settings
	switch as.IgnoreMode {
	case auth.IgnoreDisabled:
		// Do nothing.
	case auth.IgnoreByBlacklist:
		hadRule := false
		for _, id := range as.Blacklist {
			if hadRule {
				qw.N().S(",")
			}
			qw.N().S(getByIDSel(id))
			hadRule = true
		}
		if as.IncludeAnon {
			if hadRule {
				qw.N().S(",")
			}
			qw.N().S(getByAnonSel())
			hadRule = true
		}
		if hadRule {
			qw.N().S("{visibility:hidden;height:0;margin:0;padding:0}")
		}
	case auth.IgnoreByWhitelist:
		qw.N().S(".post{visibility:hidden;height:0;margin:0;padding:0}")
		// Always show own posts.
		qw.N().S(getByIDSel(ss.UserID))
		for _, id := range as.Whitelist {
			qw.N().S(",")
			qw.N().S(getByIDSel(id))
		}
		if as.IncludeAnon {
			qw.N().S(",")
			qw.N().S(getByAnonSel())
		}
		qw.N().S("{visibility:visible;height:auto;margin:0 0 10px 0;padding:4px 10px}")
	}
}
