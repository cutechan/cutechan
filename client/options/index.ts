/**
 * User-set settings storage and change handling.
 */

import { RELATIVE_TIME_PERIOD_SECS } from "../vars"
import { OptionSpec, specs, optionType } from "./specs"
import { page, posts } from "../state"
import { trigger, emitChanges, ChangeEmitter } from "../util"

export * from "./specs"

interface Options extends ChangeEmitter {
	theme: string
	imageHover: boolean
	relativeTime: boolean
	notification: boolean
	workModeToggle: boolean
	newPost: number
	workMode: number
	lang: string
}

// Central options storage model
let options = {} as Options
// Need to define all properties ahead of time for the ES5 Proxy polyfill to
// work
for (let k in specs) {
	options[k] = undefined
}
export default options = emitChanges({} as Options)

// All loaded option models
export const models: { [key: string]: OptionModel } = {}

// Controller for each individual option
class OptionModel {
	public id: string
	public spec: OptionSpec

	// Create new option model from template spec
	constructor(id: string, spec: OptionSpec) {
		this.spec = spec
		this.id = id

		// No type = checkbox + default false
		if (!spec.type) {
			spec.type = optionType.checkbox
		}

		// Store option value in central storage options Model
		const val = options[this.id] = this.get()
		options.onChange(this.id, val =>
			this.onChange(val))
		if (!spec.noExecOnStart) {
			this.execute(val)
		}
		models[this.id] = this
	}

	// Read value from localStorage
	private read(): string {
		return localStorage.getItem(this.id) || ""
	}

	// Retrieve option value from storage and parse result. If none, return
	public get(): any {
		const stored = this.read()
		if (!stored) {
			return this.spec.default
		} else {
			if (stored === 'false') {
				return false
			}
			if (stored === "true") {
				return true
			}
			const num = parseInt(stored, 10)
			if (num || num === 0) {
				return num
			}
			return stored
		}
	}

	// Handler to be executed on field change in central options storage model
	private onChange(val: any) {
		this.execute(val)
		this.set(val)
	}

	// Execute handler function, if any
	public execute(val: any) {
		if (this.spec.exec) {
			this.spec.exec(val)
		}
	}

	// Write value to localStorage, if needed
	public set(val: any) {
		if (val !== this.spec.default || this.read()) {
			localStorage.setItem(this.id, val.toString())
		}
		trigger("renderOptionValue", this.id, this.spec.type, val)
	}

	// Perform value validation, if any. Otherwise return true.
	public validate(val: any): boolean {
		if (this.spec.validation) {
			return this.spec.validation(val)
		}
		return true
	}
}

// Rerender all timestamps on posts, if set to relative time.
function renderTime() {
	for (const { view } of posts) {
		view.renderTime()
	}
}

export function init() {
	// Populate option model collection and central model
	for (let id in specs) {
		new OptionModel(id, specs[id])
	}

	options.onChange("relativeTime", renderTime)
	setInterval(() => {
		if (options.relativeTime && !page.catalog) {
			renderTime()
		}
	}, RELATIVE_TIME_PERIOD_SECS * 1000)
}
