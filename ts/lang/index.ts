/**
 * Follows lang.go structures.
 */

// tslint:disable-next-line:no-reference
/// <reference path="./index.d.ts" />

import langs from "cc-langs";

interface LanguagePack {
  Forms: { [key: string]: string[2] };
  UI: { [key: string]: string };
  Common: CommonLanguagePack;
}

// TODO(Kagami): Remove lowercase aliases.
interface CommonLanguagePack {
  Plurals: { [key: string]: string[] };
  Posts: { [key: string]: string };
  Sizes: { [key: string]: string };
  UI: { [key: string]: string };
  plurals: { [key: string]: string[] };
  posts: { [key: string]: string };
  time: {
    calendar: string[],
    week: string[],
  };
  ui: { [key: string]: string };
}

// TODO(Kagami): Add support for per-user site language.
const siteLang: string = (window as any).config.defaultLang;
const pack: any = langs[siteLang];

// TODO(Kagami): Use `ln` everywhere.
export const lang: CommonLanguagePack = {
  Plurals: pack.common.plurals,
  Posts: pack.common.posts,
  Sizes: pack.common.sizes,
  UI: pack.common.ui,
  plurals: pack.common.plurals,
  posts: pack.common.posts,
  time: pack.common.time,
  ui: pack.common.ui,
};
export const ln: LanguagePack = { Forms: pack.forms, UI: pack.ui, Common: lang };
export default lang;

// Very simple implementation.
export function printf(s: string, ...args: any[]): string {
  return s.replace(/%s/, () => args.shift());
}

/** Gettext-alike helper. */
// TODO(Kagami): Rewrite ln.UI boilerplate to this.
export function _(s: string): string {
  return pack.ui[s] || s;
}
