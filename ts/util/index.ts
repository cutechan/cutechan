/**
 * Various utility functions.
 */

export { default as FSM } from "./fsm";
export { default as Progress } from "./progress";
export { default as ShowHide } from "./show-hide";
export * from "./fetch";
export * from "./hooks";
export * from "./render";
export * from "./changes";

import { POST_SEL } from "../vars";

// Retrieve element id.
export function getID(el: Element): number {
  return el ? +el.getAttribute("data-id") : 0;
}

// Retrieve post number of closest parent post element.
export function getClosestID(el: Element): number {
  return el ? getID(el.closest(POST_SEL)) : 0;
}

// Parse HTML string to a single Node
export function makeNode(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.firstChild as HTMLElement;
}

// Parse HTML string to node array
// TODO(Kagami): Remove.
export function makeFrag(html: string): DocumentFragment {
  return document.createRange().createContextualFragment(html);
}

export interface OnOptions extends EventListenerOptions {
  selector?: string | string[];
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

const escapeMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

const unescapeMap = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

// Escape a user-submitted unsafe string to protect against XSS.
export function escape(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => escapeMap[ch]);
}

// Reverse escape() effect.
export function unescape(html: string): string {
  return html.replace(/&(amp|lt|gt|quot|apos);/g, (entity) => unescapeMap[entity]);
}

// Find the first child of an element, that matches a check function, if any
export function firstChild(
  el: Element,
  check: (el: Element) => boolean,
): HTMLElement | null {
  for (const ch of Array.from(el.children)) {
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

/** Remove item from array in place. */
export function remove<T>(arr: T[], item: T) {
  const idx = arr.indexOf(item);
  if (idx >= 0) {
    arr.splice(idx, 1);
  }
}

/** Very cool function! */
export function noop() {
  /* skip */
}

export function setter(self: any, name: string) {
  return (el: Element) => {
    self[name] = el;
  };
}

/** Like `Promise.all` but collect only successful results. */
export function collect(proms: Array<Promise<any>>): Promise<any[]> {
  const results = [] as any[];
  proms = proms.map((p) => p.then((res) => results.push(res), noop));
  return Promise.all(proms).then(() => results);
}

/** Simple string reverse. */
export function reverse(s: string): string {
  let s2 = "";
  for (let i = s.length - 1; i >= 0; i--) {
    s2 += s[i];
  }
  return s2;
}

/** Rotate recent alike list structure. */
export function rotateRecent<T>(list: T[], item: T, max: number): T[] {
  // O(n) search so passed array is supposed to be small.
  const idx = list.indexOf(item);
  return idx < 0
    ? [item, ...list.slice(0, max - 1)]
    : [item, ...list.slice(0, idx), ...list.slice(idx + 1)];
}
