// Specs for individual option models

import { config } from '../state'
import { makeEl } from "../util"

// Types of option models
export const enum optionType {
	checkbox, number, image, shortcut, menu, textarea,
}

// Full schema of the option interface
export type OptionSpec = {
	// Type of option. Determines storage and rendering method. Defaults to
	// 'checkbox', if omitted.
	type?: optionType

	// Default value. false, if omitted.
	default?: any

	// Function to execute on option change
	exec?: (val?: any) => void

	// Should the function not be executed on model population?
	noExecOnStart?: boolean

	// Function that validates the users input
	validation?: (val: any) => boolean
}

// Specifications of option behavior, where needed. Some properties defined as
// getters to prevent race with "state" module
export const specs: { [id: string]: OptionSpec } = {
	// Thumbnail inline expansion mode
	inlineFit: {
		type: optionType.menu,
		default: "width",
	},
	// Hide thumbnails
	hideThumbs: {},
	// Boss key toggle
	workModeToggle: {
		type: optionType.checkbox,
		default: false,
		exec: toggleHeadStyle("work-mode", ".image-banner{display: none;}"),
	},
	// Image hover expansion
	imageHover: {
		default: true,
	},
	// Animated GIF thumbnails
	autogif: {},
	// Enable thumbnail spoilers
	spoilers: {
		default: true,
	},
	// Desktop Notifications
	notification: {
		default: false,
		exec(enabled: boolean) {
			const req = enabled
				&& typeof Notification === "function"
				&& (Notification as any).permission !== "granted"
			if (req) {
				Notification.requestPermission()
			}
		},
	},
	// Expand post links inline
	postInlineExpand: {
		default: false,
	},
	// Relative post timestamps
	relativeTime: {
		default: true,
	},
	// Change theme
	theme: {
		type: optionType.menu,
		get default() {
			return config.defaultCSS
		},
		noExecOnStart: true,
		exec(theme: string) {
			if (!theme) {
				return
			}
			document
				.getElementById('theme-css')
				.setAttribute('href', `/static/css/${theme}.css`)
		},
	},
	// Shortcut keys
	newPost: {
		default: 78,
		type: optionType.shortcut,
	},
	workMode: {
		default: 66,
		type: optionType.shortcut,
	},
}

// Toggle an optional style element in the head
function toggleHeadStyle(
	name: string,
	css: string,
): (toggle: boolean) => void {
	return toggle => {
		const id = name + "-toggle"
		if (!document.getElementById(id)) {
			const html = `<style id="${id}">${css}</style>`
			document.head.append(makeEl(html))
		}

		// The disabled property only exists on elements in the DOM, so we do
		// another query
		(document.getElementById(id) as HTMLStyleElement).disabled = !toggle
	}
}
