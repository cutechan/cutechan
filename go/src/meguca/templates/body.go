// Post formatting renderer.
// MUST BE KEPT IN SYNC WITH ts/templates/body.ts!
package templates

import (
	"bytes"
	"meguca/common"
	"regexp"
	"strconv"

	b "github.com/cutechan/blackfriday"
	"github.com/microcosm-cc/bluemonday"
)

const htmlFlags = b.HTML_SKIP_HTML | // skip preformatted HTML blocks
	b.HTML_SKIP_STYLE | // skip embedded <style> elements
	b.HTML_SKIP_IMAGES | // skip embedded images
	// b.HTML_SKIP_LINKS                |  // skip all links
	b.HTML_SAFELINK | // only link to trusted protocols
	// b.HTML_NOFOLLOW_LINKS            |  // only link with rel="nofollow"
	b.HTML_NOREFERRER_LINKS | // only link with rel="noreferrer"
	b.HTML_HREF_TARGET_BLANK | // add a blank target
	// b.HTML_TOC                       |  // generate a table of contents
	// b.HTML_OMIT_CONTENTS             |  // skip the main contents (for a standalone table of contents)
	// b.HTML_COMPLETE_PAGE             |  // generate a complete HTML page
	// b.HTML_USE_XHTML                 |  // generate XHTML output instead of HTML
	// b.HTML_USE_SMARTYPANTS           |  // enable smart punctuation substitutions
	// b.HTML_SMARTYPANTS_FRACTIONS     |  // enable smart fractions (with HTML_USE_SMARTYPANTS)
	// b.HTML_SMARTYPANTS_DASHES        |  // enable smart dashes (with HTML_USE_SMARTYPANTS)
	// b.HTML_SMARTYPANTS_LATEX_DASHES  |  // enable LaTeX-style dashes (with HTML_USE_SMARTYPANTS and HTML_SMARTYPANTS_DASHES)
	// b.HTML_SMARTYPANTS_ANGLED_QUOTES |  // enable angled double quotes (with HTML_USE_SMARTYPANTS) for double quotes rendering
	// b.HTML_SMARTYPANTS_QUOTES_NBSP   |  // enable "French guillemets" (with HTML_USE_SMARTYPANTS)
	// b.HTML_FOOTNOTE_RETURN_LINKS     |  // generate a link at the end of a footnote to return to the source
	0

const extensions = b.EXTENSION_NO_INTRA_EMPHASIS | // ignore emphasis markers inside words
	// b.EXTENSION_TABLES                     |  // render tables
	b.EXTENSION_FENCED_CODE | // render fenced code blocks
	b.EXTENSION_AUTOLINK | // detect embedded URLs that are not explicitly marked
	b.EXTENSION_STRIKETHROUGH | // strikethrough text using ~~test~~
	// b.EXTENSION_LAX_HTML_BLOCKS            |  // loosen up HTML block parsing rules
	// b.EXTENSION_SPACE_HEADERS              |  // be strict about prefix header rules
	b.EXTENSION_HARD_LINE_BREAK | // translate newlines into line breaks
	// b.EXTENSION_TAB_SIZE_EIGHT             |  // expand tabs to eight spaces instead of four
	// b.EXTENSION_FOOTNOTES                  |  // Pandoc-style footnotes
	b.EXTENSION_NO_EMPTY_LINE_BEFORE_BLOCK | // No need to insert an empty line to start a (code, quote, ordered list, unordered list) block
	// b.EXTENSION_HEADER_IDS                 |  // specify header IDs  with {#id}
	// b.EXTENSION_TITLEBLOCK                 |  // Titleblock ala pandoc
	// b.EXTENSION_AUTO_HEADER_IDS            |  // Create the header ID from the text
	// b.EXTENSION_BACKSLASH_LINE_BREAK       |  // translate trailing backslashes into line breaks
	// b.EXTENSION_DEFINITION_LISTS           |  // render definition lists
	// b.EXTENSION_JOIN_LINES                 |  // delete newline and join lines
	0

// Should't actually be needed because we don't allow raw HTML in
// Markdown but force it anyway just to be safe.
var policy = func() *bluemonday.Policy {
	p := bluemonday.UGCPolicy()
	p.RequireNoFollowOnLinks(false)
	p.AllowAttrs("rel").Matching(bluemonday.SpaceSeparatedTokens).OnElements("a")
	p.AllowAttrs("class").Matching(bluemonday.SpaceSeparatedTokens).OnElements("a")
	p.AllowAttrs("target").Matching(regexp.MustCompile(`^_blank$`)).OnElements("a")
	p.AllowAttrs("data-id").Matching(bluemonday.Integer).OnElements("a")
	p.AllowAttrs("data-provider").Matching(bluemonday.SpaceSeparatedTokens).OnElements("a")
	return p
}()

// Embeddable links.
var Embeds = map[string]*regexp.Regexp{
	"youtube": regexp.MustCompile(
		`^https?://(?:[^\.]+\.)?` +
			`(` +
			`youtube\.com/watch/?\?(?:.+&)?v=([^&]+)` +
			`|` +
			`(?:youtu\.be|youtube\.com/embed)/([a-zA-Z0-9_-]+)` +
			`)`),
	"vlive": regexp.MustCompile(
		`^https?://(?:(?:www|m)\.)?vlive\.tv/(?:video|embed)/([0-9]+)`),
}

type renderer struct {
	links common.Links
	op    uint64
	index bool
	*b.Html
}

func (*renderer) BlockQuote(out *bytes.Buffer, text []byte) {
	out.WriteString("<blockquote>&gt; ")
	out.Write(text)
	out.WriteString("</blockquote>")
}

func (*renderer) BlockHtml(out *bytes.Buffer, text []byte) {
	b.AttrEscape(out, text)
}

func (*renderer) RawHtmlTag(out *bytes.Buffer, text []byte) {
	b.AttrEscape(out, text)
}

func (r *renderer) AutoLink(out *bytes.Buffer, link []byte, kind int) {
	for provider, pattern := range Embeds {
		if pattern.Match(link) {
			out.WriteString("<a class=\"post-embed post-" + provider + "-embed")
			out.WriteString("\" data-provider=\"" + provider)
			out.WriteString("\" href=\"")
			b.AttrEscape(out, link)
			out.WriteString("\" rel=\"noreferrer\" target=\"_blank")
			out.WriteString("\">")
			b.AttrEscape(out, link)
			out.WriteString("</a>")
			return
		}
	}
	r.Html.AutoLink(out, link, kind)
}

func (r *renderer) PostLink(out *bytes.Buffer, text []byte) {
	if r.links == nil {
		b.AttrEscape(out, text)
		return
	}

	idStr := string(text[2:])
	id, _ := strconv.ParseUint(idStr, 10, 64)
	var op uint64
	for _, l := range r.links {
		if l[0] == id {
			op = l[1]
			break
		}
	}
	if op == 0 {
		b.AttrEscape(out, text)
		return
	}

	out.WriteString(renderPostLink(id, op != r.op, r.index))
}

// Render post body Markdown to sanitized HTML.
func renderBody(p common.Post, op uint64, index bool) string {
	input := []byte(p.Body)
	renderer := &renderer{
		links: p.Links,
		op:    op,
		index: index,
		Html:  b.HtmlRenderer(htmlFlags, "", "").(*b.Html),
	}
	unsafe := b.Markdown(input, renderer, extensions)
	html := policy.SanitizeBytes(unsafe)
	return string(html)
}
