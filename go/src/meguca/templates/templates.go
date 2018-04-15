//go:generate qtc
//go:generate go-bindata -o bin_data.go --pkg templates --nometadata --prefix ../../../../mustache-pp ../../../../mustache-pp/...

// Package templates generates and stores HTML templates
package templates

import (
	"bytes"
	"fmt"
	"strings"

	"meguca/auth"
	"meguca/config"
	"meguca/lang"

	"github.com/hoisie/mustache"
)

var (
	mustacheTemplates = map[string]*mustache.Template{}
)

func Page(pos auth.Positions, title string, html string) []byte {
	var buf bytes.Buffer
	writerenderPage(&buf, pos, title, html)
	return buf.Bytes()
}

func Board(
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
	return Page(pos, title, html)
}

func Thread(
	id uint64,
	board, title string,
	abbrev bool,
	pos auth.Positions,
	postHTML []byte,
) []byte {
	html := renderThread(postHTML, id, board, title)
	return Page(pos, title, html)
}

func Landing(pos auth.Positions) []byte {
	title := lang.Get().UI["main"]
	html := renderLanding()
	return Page(pos, title, html)
}

func Stickers(pos auth.Positions, stickHTML []byte) []byte {
	html := renderStickers(stickHTML)
	title := lang.Get().UI["stickers"]
	return Page(pos, title, html)
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
