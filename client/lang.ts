// Follows lang.go structures.

type LanguagePack = {
	UI: { [key: string]: string }
	ui: { [key: string]: string }
	Common: CommonLanguagePack
	common: CommonLanguagePack
}

type CommonLanguagePack = {
	Posts: { [key: string]: string }
	posts: { [key: string]: string }
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
const current: string = (window as any).config.defaultLang

// TODO(Kagami): Use `ln` everywhere.
export const ln: LanguagePack = (window as any).CUTE_LANGS[current]
export const lang: CommonLanguagePack = ln.common
export default lang

// Emulate lang.go to simplify template porting.
ln.UI = ln.ui
ln.Common = ln.common
lang.Posts = lang.posts
lang.UI = lang.ui
