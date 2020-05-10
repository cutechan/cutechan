//go:generate qtc
//go:generate go-bindata -o bin_data.go --pkg templates --nometadata --prefix ../../mustache-pp ../../mustache-pp/...

// Package templates generates and stores HTML templates
package templates

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/cutechan/cutechan/go/auth"
	"github.com/cutechan/cutechan/go/config"
	"github.com/cutechan/cutechan/go/lang"

	"github.com/hoisie/mustache"
)

var (
	mustacheTemplates = map[string]*mustache.Template{}
)

func Page(ss *auth.Session, l, title, html string, status bool) []byte {
	var buf bytes.Buffer
	writerenderPage(&buf, ss, l, title, html, status)
	return buf.Bytes()
}

func Board(
	l, title string,
	page, total int,
	ss *auth.Session,
	catalog bool,
	threadHTML []byte,
) []byte {
	html := renderBoard(
		threadHTML,
		l, title,
		page, total,
		catalog,
	)
	return Page(ss, l, title, html, false)
}

func Thread(
	id uint64,
	l, board, title string,
	abbrev bool,
	ss *auth.Session,
	postHTML []byte,
) []byte {
	html := renderThread(postHTML, id, l, board, title)
	return Page(ss, l, title, html, true)
}

func Landing(ss *auth.Session, l string) []byte {
	title := lang.Get(l, "main")
	html := renderLanding(l)
	return Page(ss, l, title, html, false)
}

func Stickers(ss *auth.Session, l string, stickHTML []byte) []byte {
	html := renderStickers(l, stickHTML)
	title := lang.Get(l, "stickers")
	return Page(ss, l, title, html, false)
}

func Admin(
	ss *auth.Session,
	l string,
	cs config.BoardConfigs,
	staff auth.Staff,
	bans auth.BanRecords,
	log auth.ModLogRecords,
) []byte {
	html := renderAdmin(cs, staff, bans, log)
	title := lang.Get(l, "Admin")
	return Page(ss, l, title, html, false)
}

func CompileMustache() (err error) {
	for _, name := range AssetNames() {
		if strings.HasSuffix(name, ".mustache") {
			tmpl, err := mustache.ParseString(string(MustAsset(name)))
			if err != nil {
				return fmt.Errorf("failed to compile %s: %v", name, err)
			}
			tmplName := name[:len(name)-9]
			mustacheTemplates[tmplName] = tmpl
		}
	}
	return
}

func renderMustache(name string, ctx interface{}) string {
	if tmpl, ok := mustacheTemplates[name]; ok {
		return tmpl.Render(ctx)
	}
	return ""
}
