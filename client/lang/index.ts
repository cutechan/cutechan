/**
 * Follows lang.go structures.
 */

/// <reference path="./index.d.ts" />

import langs from "langs"

type LanguagePack = {
	UI: { [key: string]: string }
	Common: CommonLanguagePack
}

// TODO(Kagami): Remove lowercase aliases.
type CommonLanguagePack = {
	Posts: { [key: string]: string }
	posts: { [key: string]: string }
	Sizes: { [key: string]: string }
	plurals: { [key: string]: [string] }
	time: {
		calendar: string[]
		week: string[]
	}
	UI: { [key: string]: string }
	ui: { [key: string]: string }
	sync: string[]
}

// TODO(Kagami): Add support for per-user site language.
const siteLang: string = (window as any).config.defaultLang
const pack: any = langs[siteLang]

// TODO(Kagami): Use `ln` everywhere.
export const ln: LanguagePack = { UI: pack.ui, Common: pack.common }
export const lang: CommonLanguagePack = ln.Common
export default lang

// Emulate lang.go to simplify template porting.
lang.Posts = pack.common.posts
lang.Sizes = pack.common.sizes
