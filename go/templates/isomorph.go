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

	"github.com/cutechan/cutechan/go/auth"
	"github.com/cutechan/cutechan/go/common"
	"github.com/cutechan/cutechan/go/file"
	"github.com/cutechan/cutechan/go/lang"

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
	DName      string
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
		Auth:      lang.Get(l, p.Auth),
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
	year, m, day := t.Date()
	month := lang.Get(l, lang.Months[int(m)-1])
	weekday := lang.Get(l, lang.Days[int(t.Weekday())])

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
	switch {
	case size < 1024:
		return fmt.Sprintf("%d%s", size, lang.Get(l, "b"))
	case size < 1024*1024:
		return fmt.Sprintf("%.2f%s", float32(size)/1024, lang.Get(l, "kb"))
	default:
		return fmt.Sprintf("%.2f%s", float32(size)/1024/1024, lang.Get(l, "mb"))
	}
}

func (ctx *PostContext) Files() (files []string) {
	if len(ctx.post.Files) == 0 {
		return
	}
	for n, img := range ctx.post.Files {
		files = append(files, ctx.renderFile(img, n))
	}
	return
}

func (ctx *PostContext) renderFile(img *common.Image, n int) string {
	fileCtx := FileContext{
		SHA1:       img.SHA1,
		HasTitle:   img.Title != "",
		LCopy:      lang.Get(ctx.Lang, "clickToCopy"),
		Title:      img.Title,
		HasVideo:   img.Video,
		HasAudio:   img.Audio,
		HasLength:  img.Video || img.Audio,
		Length:     duration(img.Length),
		Record:     img.Audio && !img.Video,
		Size:       fileSize(ctx.Lang, img.Size),
		Width:      img.Dims[0],
		Height:     img.Dims[1],
		TWidth:     img.Dims[2],
		THeight:    img.Dims[3],
		DName:      ctx.getDownloadName(n, img),
		SourcePath: file.SourcePath(img.FileType, img.SHA1),
		ThumbPath:  file.ThumbPath(img.ThumbType, img.SHA1),
	}
	return renderMustache("post-file", &fileCtx)
}

func (ctx *PostContext) getDownloadName(n int, img *common.Image) string {
	numStr := ""
	if n > 0 {
		numStr = fmt.Sprintf("(%d)", n+1)
	}
	ext := common.Extensions[img.FileType]
	return fmt.Sprintf("%s-%d%s.%s", ctx.Board, ctx.post.ID, numStr, ext)
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
		LReplies:  lang.Get(ctx.Lang, "replies"),
		Backlinks: rendered,
	}
	return renderMustache("post-backlinks", &linkCtx)
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
