/**
 * Follows lang.go structures.
 */

// tslint:disable-next-line:no-reference
/// <reference path="index.d.ts" />

import langs from "cc-langs";

interface LanguagePack {
  Forms: { [key: string]: string[2] };
  UI: { [key: string]: string };
  Common: CommonLanguagePack;
}

// TODO(Kagami): Remove lowercase aliases.
interface CommonLanguagePack {
  Plurals: { [key: string]: string[] };
  time: { calendar: string[], week: string[] };
}

// TODO(Kagami): Add support for per-user site language.
const siteLang: string = (window as any).config.defaultLang;
const pack: any = langs[siteLang];
const lang: CommonLanguagePack = {
  Plurals: pack.common.plurals,
  time: pack.common.time,
};

/** Container of localization strings for current site language. Deprecated. */
export const ln: LanguagePack = { Forms: pack.forms, UI: pack.ui, Common: lang };

/** Gettext-alike helper. */
// TODO(Kagami): Rewrite ln.UI boilerplate to this.
export function _(s: string): string {
  return pack.ui[s] || s;
}

/** Printf-alike helper. */
export function printf(s: string, ...args: any[]): string {
  return s.replace(/%s/, () => args.shift());
}
