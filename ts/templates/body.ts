/**
 * Post formatting renderer.
 */
// MUST BE KEPT IN SYNC WITH go/src/meguca/templates/body.go!

import { renderPostLink } from ".";  // TODO(Kagami): Avoid circular import
import { PostData, PostLink } from "../common";
import { page } from "../state";
import { escape, unescape } from "../util";
import marked from "./marked";

interface AnyClass { new(...args: any[]): any; }

const noop = marked.noop;

// Verify and render a link to other posts.
function postLink(m: RegExpMatchArray, links: PostLink[], tid: number): string {
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
      del: /^%%([\s\S]+?)%%/,
      link: noop,
      nolink: noop,
      reflink: /^>>\d+()/,
      text: new RegExp(textSrc.replace("]|", ">%]|")),
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

const embeds = {
  vlive:
    String.raw`https?://(?:(?:www|m)\.)?vlive\.tv/video/([0-9]+)`,
  youtube:
    String.raw`https?://(?:[^\.]+\.)?` +
    String.raw`(?:youtube\.com/watch\?(?:.+&)?v=|youtu\.be/)` +
    String.raw`([a-zA-Z0-9_-]+)`,
  youtubepls:
    String.raw`https?://(?:[^\.]+\.)?` +
    String.raw`youtube\.com/playlist\?(?:.+&)?list=` +
    String.raw`([a-zA-Z0-9_-]+)`,
};
export const bodyEmbeds: { [key: string]: RegExp } = (() => {
  const m = {};
  for (const provider of Object.keys(embeds)) {
    m[provider] = new RegExp(embeds[provider]);
  }
  return m;
})();
export const linkEmbeds: { [key: string]: RegExp } = (() => {
  const m = {};
  for (const provider of Object.keys(embeds)) {
    m[provider] = new RegExp("^" + embeds[provider]);
  }
  return m;
})();

// tslint:disable-next-line:max-classes-per-file
class CustomRenderer extends (marked as any).Renderer {
  public blockquote(quote: string): string {
    return "<blockquote>&gt; " + quote + "</blockquote>";
  }
  // Stricter check for protocols.
  public link(href: string, title: string, text: string): string {
    if (!href.startsWith("http://") && !href.startsWith("https://")) {
      return href;
    }
    let out = "<a ";
    for (const provider of Object.keys(linkEmbeds)) {
      if (linkEmbeds[provider].test(unescape(href))) {
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
