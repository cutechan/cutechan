/**
 * Various utility functions.
 */

import { POST_SEL } from "../vars";

export { default as FSM } from "./fsm";
export { default as Progress } from "./progress";
export { default as ShowHide } from "./show-hide";
export * from "./fetch";
export * from "./hooks";
export * from "./render";
export * from "./changes";

// Any object with an event-based interface for passing to load()
interface Loader {
  onload: EventListener;
  onerror: EventListener;
}

// Retrieve element id.
export function getID(el: Element): number {
  return el ? +el.getAttribute("data-id") : 0;
}

// Retrieve post number of closest parent post element.
export function getClosestID(el: Element): number {
  return el ? getID(el.closest(POST_SEL)) : 0;
}

// Parse HTML string to node array
export function makeFrag(DOMString: string): DocumentFragment {
  const el = document.createElement("template") as HTMLTemplateElement;
  el.innerHTML = DOMString;
  return el.content;
}

export interface OnOptions extends EventListenerOptions {
  selector?: string | [string];
}

// Add an event listener that optionally filters targets according to a
// CSS selector.
export function on(
  el: EventTarget,
  type: string,
  fn: EventListener,
  opts?: OnOptions,
) {
  if (opts && opts.selector) {
    const origFn = fn;
    const selector = Array.isArray(opts.selector)
      ? opts.selector.join(",")
      : opts.selector;
    fn = (event) => {
      const t = event.target;
      if (t instanceof Element && t.matches(selector)) {
        origFn(event);
      }
    };
  }
  el.addEventListener(type, fn, opts);
}

// Pad an integer with a leading zero, if below 10
export function pad(n: number): string {
  return (n < 10 ? "0" : "") + n;
}

// Template string tag function for HTML. Strips indentation and newlines.
export function HTML(base: TemplateStringsArray, ...args: string[]): string {
  let output = base[0];
  for (let i = 1; i <= args.length; i++) {
    output += args[i - 1] + base[i];
  }
  return output.replace(/[\t\n]+/g, "");
}

// Generate an HTML element attribute list. If a key has an empty string, it's
// value will be considered "true"
export function makeAttrs(attrs: { [key: string]: string }): string {
  let html = "";
  for (const key of Object.keys(attrs)) {
    html += " " + key;
    const val = attrs[key];
    if (val) {
      html += `="${val}"`;
    }
  }
  return html;
}

// Set attributes from a key-value map to the element
export function setAttrs(el: Element, attrs: { [key: string]: string }) {
  for (const key of Object.keys(attrs)) {
    el.setAttribute(key, attrs[key]);
  }
}

// Copy all properties from the source object to the destination object. Nested
// objects are extended recursively.
export function extend(dest: {}, source: {}) {
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (typeof val === "object" && val !== null) {
      const d = dest[key];
      if (d) {
        extend(d, val);
      } else {
        dest[key] = val;
      }
    } else {
      dest[key] = val;
    }
  }
}

// Wraps event style object with onload() method to Promise style
export function load(loader: Loader): Promise<Event> {
  return new Promise<Event>((resolve, reject) => {
    loader.onload = resolve;
    loader.onerror = reject;
  });
}

// tslint:disable:object-literal-sort-keys
const escapeMap: { [key: string]: string } = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "`": "&#x60;",
};
// tslint:enable:object-literal-sort-keys

// Escape a user-submitted unsafe string to protect against XSS.
export function escape(str: string): string {
  return str.replace(/[&<>"'`]/g, (char) =>
    escapeMap[char]);
}

// Find the first child of an element, that matches a check function, if any
export function firstChild(
  el: Element,
  check: (el: Element) => boolean,
): HTMLElement | null {
  // tslint:disable-next-line:prefer-for-of
  for (let i = 0; i < el.children.length; i++) {
    const ch = el.children[i];
    if (check(ch)) {
      return ch as HTMLElement;
    }
  }
  return null;
}

// Returns an input element inside the parent by name
export function inputElement(
  parent: NodeSelector,
  name: string,
): HTMLInputElement {
  return parent.querySelector(`input[name="${name}"]`) as HTMLInputElement;
}

// Get a cookie value by name. Returns empty string, if none.
export function getCookie(id: string): string {
  const kv = document.cookie
    .split(";")
    .map((s) =>
      s.trim())
    .filter((s) =>
      s.startsWith(id));
  if (!kv.length) {
    return "";
  }
  return kv[0].split("=")[1];
}

// Delete a `path=/` cookie by id
export function deleteCookie(id: string) {
  document.cookie = `${id}=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT`;
}

// Extract JSON from a <script> tag by ID
export function extractJSON(id: string): any {
  const el = document.getElementById(id);
  if (!el) {
    return null;
  }
  return JSON.parse(el.textContent);
}

// Are we at bottom of the page.
export function isAtBottom() {
  const el = document.documentElement;
  return el.scrollHeight - el.scrollTop <= el.clientHeight + 10;
}

// Scroll to the top of the page.
export function scrollToTop() {
  window.scrollTo(0, 0);
}

// Scroll to the bottom of the thread.
export function scrollToBottom() {
  window.scrollTo(0, document.documentElement.scrollHeight);
}

// https://stackoverflow.com/a/30810322
export function copyToClipboard(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}
