/**
 * Follows lang.go structures.
 */

/// <reference path="./index.d.ts" />

import langs from "langs"

type LanguagePack = {
  Forms: { [key: string]: string[2] }
  UI: { [key: string]: string }
  Common: CommonLanguagePack
}

// TODO(Kagami): Remove lowercase aliases.
type CommonLanguagePack = {
  Posts: { [key: string]: string }
  posts: { [key: string]: string }
  Sizes: { [key: string]: string }
  Plurals: { [key: string]: [string] }
  plurals: { [key: string]: [string] }
  time: {
    calendar: string[]
    week: string[]
  }
  UI: { [key: string]: string }
  ui: { [key: string]: string }
}

// TODO(Kagami): Add support for per-user site language.
const siteLang: string = (window as any).config.defaultLang
const pack: any = langs[siteLang]

// TODO(Kagami): Use `ln` everywhere.
export const lang: CommonLanguagePack = {
  Posts: pack.common.posts,
  posts: pack.common.posts,
  Sizes: pack.common.sizes,
  Plurals: pack.common.plurals,
  plurals: pack.common.plurals,
  time: pack.common.time,
  UI: pack.common.ui,
  ui: pack.common.ui,
}
export const ln: LanguagePack = { Forms: pack.forms, UI: pack.ui, Common: lang }
export default lang

// Very simple implementation.
export function printf(s: string, ...args: any[]): string {
  return s.replace(/%s/, () => args.shift())
}
