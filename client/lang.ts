// Follows lang.go structures.

type LanguagePack = {
	Common: CommonLanguagePack
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

const lang: CommonLanguagePack = (window as any).CUTE_LANGS[current]
lang.Posts = lang.posts
lang.UI = lang.ui
export default lang

// Emulate lang.go to simplify template porting.
export const ln: LanguagePack = {Common: lang}
