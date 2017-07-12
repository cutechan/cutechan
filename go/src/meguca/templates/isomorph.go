// MUST BE KEPT IN SYNC WITH client/templates/isomorph.ts!
// Template structs, helper routines and context providers.
// TODO(Kagami): Move everything common to isomorph package?

package templates

import (
	"fmt"
	"time"
	"strings"
	"strconv"
	"meguca/common"
	"meguca/config"
	"meguca/imager/assets"
	"meguca/lang"

	"github.com/valyala/quicktemplate"
)

type PostContext struct {
	ID uint64
	TID uint64
	Index bool
	OP bool
	Board string
	Subject string
	Staff bool
	Auth string
	Banned bool
	LBanned string
	post common.Post
	backlinks common.Backlinks
}

type FileContext struct {
	HasArtist bool
	Artist string
	HasTitle bool
	Title string
	HasAudio bool
	HasLength bool
	Length string
	Size string
	TWidth uint16
	THeight uint16
	Width uint16
	Height uint16
	SourcePath string
	ThumbPath string
}

type PostLinkContext struct {
	ID string
	URL string
	Cross bool
}

type BacklinksContext struct {
	LReplies string
	Backlinks []string
}

// FIXME(Kagami): Return pointer, don't create context for each post?
func MakePostContext(t common.Thread, p common.Post, bls common.Backlinks, index bool) PostContext {
	ln := lang.Get()
	return PostContext{
		ID: p.ID,
		TID: t.ID,
		Index: index,
		OP: t.ID == p.ID,
		Board: t.Board,
		Subject: t.Subject,
		Staff: p.Auth != "",
		Auth: ln.Common.Posts[p.Auth],
		Banned: p.Banned,
		LBanned: ln.Common.Posts["banned"],
		post: p,
		backlinks: bls,
	}
}

func (ctx PostContext) Render() string {
	return renderMustache("post", ctx)
}

func (ctx PostContext) PostClass() string {
	classes := []string{"post"}
	if ctx.OP {
		classes = append(classes, "post_op")
	}
	if ctx.post.Image != nil {
		classes = append(classes, "post_file")
	}
	return strings.Join(classes, " ")
}

func (ctx PostContext) URL() (url string) {
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

func (ctx PostContext) Time() string {
	ln := lang.Get().Common.Time

	t := time.Unix(ctx.post.Time, 0)
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
	return fmt.Sprintf("%02d:%02d", l / 60, l % 60)
}

// Formats a human-readable representation of file size.
func fileSize(size int) string {
	sizes := lang.Get().Common.Sizes
	switch {
	case size < 1024:
		return fmt.Sprintf("%d%s", size, sizes["b"])
	case size < 1024 * 1024:
		return fmt.Sprintf("%.2f%s", float32(size) / 1024, sizes["kb"])
	default:
		return fmt.Sprintf("%.2f%s", float32(size) / 1024 / 1024, sizes["mb"])
	}
}

func (ctx PostContext) File() string {
	if ctx.post.Image == nil {
		return ""
	} else {
		img := ctx.post.Image
		ctx := FileContext{
			HasArtist: img.Artist != "",
			Artist: img.Artist,
			HasTitle: img.Title != "",
			Title: img.Title,
			HasAudio: img.Audio,
			HasLength: img.Length != 0,
			Length: duration(img.Length),
			Size: fileSize(img.Size),
			TWidth: img.Dims[0],
			THeight: img.Dims[1],
			Width: img.Dims[2],
			Height: img.Dims[3],
			SourcePath: assets.SourcePath(img.FileType, img.SHA1),
			ThumbPath: assets.ThumbPath(img.ThumbType, img.SHA1),
		}
		return renderMustache("post-file", ctx)
	}
}

func (ctx PostContext) Body() string {
	buf := quicktemplate.AcquireByteBuffer()
	defer quicktemplate.ReleaseByteBuffer(buf)
	w := quicktemplate.AcquireWriter(buf)
	defer quicktemplate.ReleaseWriter(w)
	streambody(w, ctx.post, ctx.TID, ctx.Index)
	return string(buf.B)
}

// Render a link to another post. Can optionally be cross-thread.
func postLink(id uint64, cross, index bool) string {
	idStr := strconv.FormatUint(id, 10)
	url := ""
	if cross || index {
		url += "/all/" + idStr
	}
	url += "#" + idStr
	ctx := PostLinkContext{
		ID: idStr,
		URL: url,
		Cross: cross,
	}
	return renderMustache("post-link", ctx)
}

func (ctx PostContext) Backlinks() string {
	if links := ctx.backlinks[ctx.ID]; links != nil {
		var list []string
		for id, op := range links {
			list = append(list, postLink(id, op != ctx.TID, ctx.Index))
		}
		ln := lang.Get()
		ctx := BacklinksContext{
			LReplies: ln.Common.UI["replies"],
			Backlinks: list,
		}
		return renderMustache("post-backlinks", ctx)
	} else {
		return ""
	}
}

func getPluralFormIndex(langCode string, n int) int {
	switch langCode {
	case "ru":
		if n%10==1 && n%100!=11 {
			return 0
		} else if n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) {
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
