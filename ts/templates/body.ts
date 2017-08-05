/**
 * Post formatting renderer.
 */
// MUST BE KEPT IN SYNC WITH go/src/meguca/templates/body.go!

import * as marked from "marked";
import { renderPostLink } from ".";  // TODO(Kagami): Avoid circular import
import { PostData, PostLink } from "../common";
import { page } from "../state";
import { escape } from "../util";

interface AnyClass { new(...args: any[]): any; }

function noop() { /* skip */ }
(noop as any).exec = noop;

// Verify and render a link to other posts.
function postLink(m: RegExpMatchArray, links: [PostLink], tid: number): string {
  if (!links) return escape(m[0]);

  const id = +m[0].slice(2);
  const link = links.find((l) => l[0] === id);
  if (!link) return escape(m[0]);

  const op = link[1];
  const cross = op !== tid;
  const index = !page.thread;
  return renderPostLink(id, cross, index);
}

class CustomLexer extends ((marked as any).Lexer as AnyClass) {
  constructor(options: any) {
    super(options);
    // TODO(Kagami): Remove def from regexes?
    Object.assign(this.rules, {
      blockquote: /^( *>[^>\n][^\n]*)/,
      code: noop,
      def: noop,
      heading: noop,
      hr: noop,
      lheading: noop,
    });
  }
}

// tslint:disable-next-line:max-classes-per-file
class CustomInlineLexer extends ((marked as any).InlineLexer as AnyClass) {
  constructor(links: any, options: any, post: PostData) {
    // XXX(Kagami): Inject post link logic via hardcoded link defs.
    // Hacky, but unfortunately marked can't be easily extended.
    links[""] = {href: "post-link", title: ""};
    super(links, options);
    this.post = post;
    const textSrc = this.rules.text.source;
    Object.assign(this.rules, {
      del: /^%%(?=\S)([\s\S]*?\S)%%/,
      link: noop,
      nolink: noop,
      reflink: /^>>\d+()/,
      text: new RegExp(textSrc.replace("]|", "%]|")),
    });
  }
  protected outputLink(cap: any, link: any) {
    if (link.href === "post-link") {
      return postLink(cap, this.post.links, this.post.op);
    }
    return super.outputLink(cap, link);
  }
}

// tslint:disable-next-line:max-classes-per-file
class CustomParser extends ((marked as any).Parser as AnyClass) {
  public parse(src: any, post: PostData) {
    this.inline = new CustomInlineLexer(src.links, this.options, post);
    this.tokens = src.reverse();

    let out = "";
    while (this.next()) {
      out += this.tok();
    }

    return out;
  }
}

// Embeddable links.
export const embeds = {
  vlive: new RegExp(
    String.raw`^https?://(?:(?:www|m)\.)?vlive\.tv/(?:video|embed)/([0-9]+)`),
  youtube: new RegExp(
    String.raw`^https?://(?:[^\.]+\.)?` +
    String.raw`(` +
    String.raw`youtube\.com/watch/?\?(?:.+&)?v=([^&]+)` +
    String.raw`|` +
    String.raw`(?:youtu\.be|youtube\.com/embed)/([a-zA-Z0-9_-]+)` +
    String.raw`)`),
};

// tslint:disable-next-line:max-classes-per-file
class CustomRenderer extends marked.Renderer {
  public blockquote(quote: string): string {
    return "<blockquote>&gt; " + quote + "</blockquote>";
  }
  // Stricter check for protocols.
  public link(href: string, title: string, text: string): string {
    if (!href.startsWith("http://") && !href.startsWith("https://")) {
      return href;
    }
    let out = "<a ";
    for (const provider of Object.keys(embeds)) {
      if (embeds[provider].test(href)) {
        out += ` class="post-embed post-${provider}-embed"`;
        out += ` data-provider="${provider}"`;
        break;
      }
    }
    out += ` href="${href}"`;
    out += ' rel="noreferrer" target="_blank"';
    out += `>${text}</a>`;
    return out;
  }
}

// Render post body Markdown to sanitized HTML.
export function render(post: PostData): string {
  // tslint:disable:object-literal-sort-keys
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
  });
  // tslint:enable:object-literal-sort-keys
  const lexer = new CustomLexer(options);
  const tokens = lexer.lex(post.body);
  const parser = new CustomParser(options);
  return parser.parse(tokens, post);
}
