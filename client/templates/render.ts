import * as Mustache from "mustache"
import templates from "templates"
import { makeEl } from "../util"

// FIXME(Kagami): This naming sucks.
export type Ctx = { [key: string]: any }

export class TemplateContext {
	private template: string
	private ctx: Ctx

	constructor(name: string, ctx: Ctx) {
		this.template = templates[name]
		this.ctx = ctx
	}

	render(): string {
		return Mustache.render(this.template, this.ctx)
	}

	renderNode(): HTMLElement {
		return makeEl(this.render())
	}
}
