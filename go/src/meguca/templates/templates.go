//go:generate qtc
//go:generate go-bindata -o bin_data.go --pkg templates --nometadata --prefix ../../../../mustache-pp ../../../../mustache-pp/...

// Package templates generates and stores HTML templates
package templates

import (
	"bytes"
	"fmt"
	"net/http"
	"strings"

	"meguca/auth"
	"meguca/config"
	"meguca/lang"

	"github.com/hoisie/mustache"
)

var (
	mustacheTemplates = map[string]*mustache.Template{}
)

func Page(r *http.Request, pos auth.Positions, title string, html string) []byte {
	var buf bytes.Buffer
	classes := posClasses(pos)
	if _, err := r.Cookie("fonts_loaded"); err == nil {
		classes = append(classes, "fonts_loaded")
	}
	cls := strings.Join(classes, " ")
	writerenderPage(&buf, cls, pos, title, html)
	return buf.Bytes()
}

func Board(
	r *http.Request,
	b string,
	page, total int,
	pos auth.Positions,
	minimal, catalog bool,
	threadHTML []byte,
) []byte {
	boardConf := config.GetBoardConfigs(b)
	title := boardConf.Title
	if b == "all" {
		title = lang.Get().UI["aggregator"]
	}
	html := renderBoard(
		threadHTML,
		b, title,
		boardConf,
		page, total,
		catalog,
	)
	if minimal {
		return []byte(html)
	}
	return Page(r, pos, title, html)
}

func Thread(
	r *http.Request,
	id uint64,
	board, title string,
	abbrev bool,
	pos auth.Positions,
	postHTML []byte,
) []byte {
	html := renderThread(postHTML, id, board, title)
	return Page(r, pos, title, html)
}

func Landing(r *http.Request, pos auth.Positions) []byte {
	title := lang.Get().UI["main"]
	html := renderLanding()
	return Page(r, pos, title, html)
}

func Stickers(r *http.Request, pos auth.Positions, stickHTML []byte) []byte {
	html := renderStickers(stickHTML)
	title := lang.Get().UI["stickers"]
	return Page(r, pos, title, html)
}

func CompileMustache() (err error) {
	for _, name := range AssetNames() {
		if strings.HasSuffix(name, ".mustache") {
			tmpl, err := mustache.ParseString(string(MustAsset(name)))
			if err != nil {
				return fmt.Errorf("Failed to compile %s: %v", name, err)
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
