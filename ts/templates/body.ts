/**
 * Post formatting renderer.
 */
// MUST BE KEPT IN SYNC WITH go/src/meguca/templates/body.go!

import * as marked from "marked"
import { escape } from "../util"
import { PostData, PostLink } from "../common"
import { renderPostLink } from "."  // TODO(Kagami): Avoid circular import

type AnyClass = { new(...args: any[]): any }

function noop() {}
;(noop as any).exec = noop

// Verify and render a link to other posts.
function postLink(m: RegExpMatchArray, links: [PostLink], thread: number): string {
  if (!links) return escape(m[0])

  const id = +m[0].slice(2)
  const link = links.find(l => l[0] === id)
  if (!link) return escape(m[0])

  return renderPostLink(id, link[1], thread)
}

class CustomLexer extends ((marked as any).Lexer as AnyClass) {
  constructor(options: any) {
    super(options)
    // TODO(Kagami): Remove def from regexes?
    Object.assign(this.rules, {
      code: noop,
      hr: noop,
      heading: noop,
      lheading: noop,
      blockquote: /^( *>[^>\n][^\n]*)/,
      def: noop,
    })
  }
}

class CustomInlineLexer extends ((marked as any).InlineLexer as AnyClass) {
  constructor(links: any, options: any, post: PostData) {
    // XXX(Kagami): Inject post link logic via hardcoded link defs.
    // Hacky, but unfortunately marked can't be easily extended.
    links[""] = {href: "post-link", title: ""}
    super(links, options)
    this.post = post
    const textSrc = this.rules.text.source
    Object.assign(this.rules, {
      link: noop,
      reflink: /^>>\d+()/,
      nolink: noop,
      del: /^%%(?=\S)([\s\S]*?\S)%%/,
      text: new RegExp(textSrc.replace("]|", "%]|")),
    })
  }
  outputLink(cap: any, link: any) {
    if (link.href === "post-link") {
      return postLink(cap, this.post.links, this.post.op)
    }
    return super.outputLink(cap, link)
  }
}

class CustomParser extends ((marked as any).Parser as AnyClass) {
  parse(src: any, post: PostData) {
    this.inline = new CustomInlineLexer(src.links, this.options, post)
    this.tokens = src.reverse()

    let out = ""
    while (this.next()) {
      out += this.tok()
    }

    return out
  }
}

class CustomRenderer extends marked.Renderer {
  blockquote(quote: string): string {
    return "<blockquote>&gt; " + quote + "</blockquote>"
  }
  // Stricter check for protocols.
  link(href: string, title: string, text: string): string {
    if (!href.startsWith("http://") && !href.startsWith("https://")) {
      return href
    }
    let out = '<a href="' + href + '"'
    out += ' rel="noreferrer" target="_blank"'
    if (title) {
      out += ' title="' + title + '"'
    }
    out += ">" + text + "</a>"
    return out
  }
}

// Render post body Markdown to sanitized HTML.
export function render(post: PostData): string {
  const options = Object.assign({}, (marked as any).defaults, {
    // gfm: true,
    tables: false,
    breaks: true,
    // pedantic: false,
    sanitize: true,  // Very important!
    // sanitizer: null,
    // mangle: true,
    // smartLists: false,
    // silent: false,
    // highlight: null,
    // langPrefix: 'lang-',
    // smartypants: false,
    // headerPrefix: '',
    renderer: new CustomRenderer(),
    // xhtml: false
  })
  const lexer = new CustomLexer(options)
  const tokens = lexer.lex(post.body)
  const parser = new CustomParser(options)
  return parser.parse(tokens, post)
}
