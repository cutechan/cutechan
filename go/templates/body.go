// Post formatting renderer.
// MUST BE KEPT IN SYNC WITH ts/templates/body.ts!
package templates

import (
	"bytes"
	"github.com/cutechan/cutechan/go/common"
	"regexp"
	"strconv"

	b "github.com/cutechan/blackfriday"
	"github.com/cutechan/cutechan/go/smiles"
	"github.com/microcosm-cc/bluemonday"
)

const HtmlFlags = 0 |
	b.HTML_SKIP_HTML | // skip preformatted HTML blocks
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

const Extensions = 0 |
	b.EXTENSION_NO_INTRA_EMPHASIS | // ignore emphasis markers inside words
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
	p.AllowAttrs("class").Matching(bluemonday.SpaceSeparatedTokens).OnElements("i")
	p.AllowAttrs("title").Matching(regexp.MustCompile(`^[-:!%\w]+$`)).OnElements("i")
	return p
}()

var embeds = map[string]string{
	"vlive": `https?://(?:(?:www|m)\.)?vlive\.tv/video/([0-9]+)`,
	"youtube": `https?://(?:[^\.]+\.)?` +
		`(?:youtube\.com/watch\?(?:.+&)?v=|youtu\.be/)` +
		`([a-zA-Z0-9_-]+)`,
	"youtubepls": `https?://(?:[^\.]+\.)?` +
		`youtube\.com/playlist\?(?:.+&)?list=` +
		`([a-zA-Z0-9_-]+)`,
}
var BodyEmbeds = func() map[string]*regexp.Regexp {
	m := make(map[string]*regexp.Regexp, len(embeds))
	for provider, patternSrc := range embeds {
		m[provider] = regexp.MustCompile(patternSrc)
	}
	return m
}()
var LinkEmbeds = func() map[string]*regexp.Regexp {
	m := make(map[string]*regexp.Regexp, len(embeds))
	for provider, patternSrc := range embeds {
		m[provider] = regexp.MustCompile("^" + patternSrc)
	}
	return m
}()

var (
	RollQueryRe = regexp.MustCompile(`^(0|[1-9][0-9]?)-([1-9][0-9]?[0-9]?)$`)
	FlipQueryRe = regexp.MustCompile(`^([1-9][0-9]?)%$`)
)

type renderer struct {
	op       uint64
	index    bool
	links    common.Links
	commands common.Commands
	cmdi     int
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
	for provider, pattern := range LinkEmbeds {
		if pattern.Match(link) {
			out.WriteString("<a class=\"post-embed post-" + provider + "-embed")
			out.WriteString(" trigger-media-hover")
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

func (r *renderer) Smile(out *bytes.Buffer, text []byte, id string) {
	if !smiles.Smiles[id] {
		b.AttrEscape(out, text)
		return
	}

	out.WriteString("<i class=\"smile smile-")
	out.WriteString(id)
	out.WriteString("\" title=\":")
	out.WriteString(id)
	out.WriteString(":\"></i>")
}

func (r *renderer) Command(out *bytes.Buffer, text []byte, c, q string) {
	if r.cmdi >= len(r.commands) {
		b.AttrEscape(out, text)
		return
	}
	cmd := r.commands[r.cmdi]

	switch c {
	case "roll":
		if RollQueryRe.MatchString(q) {
			out.WriteString("<i class=\"fa fa-cube post-command post-roll-command")
			out.WriteString("\" title=\"")
			out.Write(text)
			out.WriteString("\"> ")
			out.WriteString(strconv.Itoa(cmd.Roll))
			out.WriteString(" (")
			out.WriteString(q)
			out.WriteString(")</i>")
			r.cmdi++
			return
		}
	case "flip":
		if FlipQueryRe.MatchString(q) {
			out.WriteString("<i class=\"fa fa-cube post-command post-flip-command ")
			if cmd.Flip {
				out.WriteString("post-flip-command_hit")
			} else {
				out.WriteString("post-flip-command_miss")
			}
			out.WriteString("\" title=\"")
			out.Write(text)
			out.WriteString("\"> ")
			out.WriteString(q)
			out.WriteString("</i>")
			r.cmdi++
			return
		}
	}

	b.AttrEscape(out, text)
}

// Render post body Markdown to sanitized HTML.
func renderBody(p *common.Post, op uint64, index bool) string {
	input := []byte(p.Body)
	renderer := &renderer{
		op:       op,
		index:    index,
		links:    p.Links,
		commands: p.Commands,
		cmdi:     0,
		Html:     b.HtmlRenderer(HtmlFlags, "", "").(*b.Html),
	}
	unsafe := b.Markdown(input, renderer, Extensions)
	html := policy.SanitizeBytes(unsafe)
	return string(html)
}
