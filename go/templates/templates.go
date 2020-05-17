//go:generate qtc
//go:generate go-bindata -o bin_data.go --pkg templates --nometadata --prefix ../../mustache-pp ../../mustache-pp/...

// Package templates generates and stores HTML templates
package templates

import (
	"bytes"
	"fmt"
	"net/http"
	"strings"

	"github.com/cutechan/cutechan/go/auth"
	"github.com/cutechan/cutechan/go/config"
	"github.com/cutechan/cutechan/go/lang"

	"github.com/hoisie/mustache"
)

var (
	mustacheTemplates = map[string]*mustache.Template{}
)

// Params are essential params for any rendered page.
type Params struct {
	Req     *http.Request
	Session *auth.Session
	Lang    string
}

func Page(p Params, title, html string, status bool) []byte {
	var buf bytes.Buffer
	writerenderPage(&buf, p, title, html, status)
	return buf.Bytes()
}

func Board(
	p Params,
	title string,
	page, total int,
	catalog bool,
	threadHTML []byte,
) []byte {
	html := renderBoard(
		threadHTML,
		p.Lang, title,
		page, total,
		catalog,
	)
	return Page(p, title, html, false)
}

func Thread(
	p Params,
	id uint64,
	board, title string,
	abbrev bool,
	postHTML []byte,
) []byte {
	html := renderThread(postHTML, id, p.Lang, board, title)
	return Page(p, title, html, true)
}

func Landing(p Params) []byte {
	title := lang.Get(p.Lang, "main")
	html := renderLanding(p.Lang)
	return Page(p, title, html, false)
}

func Stickers(p Params, stickHTML []byte) []byte {
	html := renderStickers(p.Lang, stickHTML)
	title := lang.Get(p.Lang, "stickers")
	return Page(p, title, html, false)
}

func Admin(
	p Params,
	cs config.BoardConfigs,
	staff auth.Staff,
	bans auth.BanRecords,
	log auth.ModLogRecords,
) []byte {
	html := renderAdmin(cs, staff, bans, log)
	title := lang.Get(p.Lang, "Admin")
	return Page(p, title, html, false)
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
