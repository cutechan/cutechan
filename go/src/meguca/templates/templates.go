//go:generate qtc
//go:generate go-bindata -o bin_data.go --pkg templates --nometadata --prefix ../../../../mustache-pp ../../../../mustache-pp/...

// Package templates generates and stores HTML templates
package templates

import (
	"bytes"
	"fmt"
	"github.com/hoisie/mustache"
	h "html"
	"meguca/auth"
	"meguca/config"
	"meguca/lang"
	"strings"
	"sync"
)

var (
	indexTemplates map[auth.ModerationLevel][3][]byte
	mu             sync.RWMutex

	mustacheTemplates = map[string]*mustache.Template{}
)

// Injects dynamic variables, hashes and stores compiled templates
func Compile() error {
	levels := [...]auth.ModerationLevel{
		auth.NotLoggedIn, auth.NotStaff, auth.Janitor, auth.Moderator,
		auth.BoardOwner, auth.Admin,
	}
	t := make(map[auth.ModerationLevel][3][]byte, len(levels))
	for _, pos := range levels {
		split := bytes.Split([]byte(renderIndex(pos)), []byte("$$$"))
		t[pos] = [3][]byte{split[0], split[1], split[2]}
	}

	mu.Lock()
	indexTemplates = t
	mu.Unlock()

	return nil
}

// Board renders board page HTML.
func Board(
	b string,
	page, total int,
	pos auth.ModerationLevel,
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
		pos,
		catalog,
	)
	if minimal {
		return []byte(html)
	}
	return execIndex(html, title, pos)
}

// Thread renders thread page HTML.
func Thread(
	id uint64,
	board, title string,
	abbrev bool,
	pos auth.ModerationLevel,
	postHTML []byte,
) []byte {
	html := renderThread(postHTML, id, board, title, pos)
	return execIndex(html, title, pos)
}

// Render landing page.
func Landing(pos auth.ModerationLevel) []byte {
	html := renderLanding()
	title := lang.Get().UI["main"]
	return execIndex(html, title, pos)
}

// Render stickers page.
func Stickers(pos auth.ModerationLevel, stickHTML []byte) []byte {
	html := renderStickers(stickHTML)
	title := lang.Get().UI["stickers"]
	return execIndex(html, title, pos)
}

// Execute and index template in the second pass
func execIndex(html, title string, pos auth.ModerationLevel) []byte {
	title = h.EscapeString(title)
	mu.RLock()
	t := indexTemplates[pos]
	mu.RUnlock()
	return bytes.Join([][]byte{
		t[0],
		[]byte(title),
		t[1],
		[]byte(html),
		t[2],
	}, nil)
}

func CompileMustache() error {
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
	return nil
}

func renderMustache(name string, ctx interface{}) string {
	if tmpl, ok := mustacheTemplates[name]; ok {
		return tmpl.Render(ctx)
	}
	return ""
}
