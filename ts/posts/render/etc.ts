/**
 * Miscellaneous post component rendering functions.
 */

import { ln } from "../../lang"
import { page, mine } from '../../state'
import { TemplateContext, pluralize } from "../../templates"

// Render a link to other post.
export function renderPostLink(id: number, op: number, thread?: number): string {
	thread = thread || page.thread
	const cross = op !== thread
	const index = !page.thread && !page.catalog
	const url = `${(cross || index) ? `/all/${id}` : ""}#${id}`
	return new TemplateContext("post-link", {
		ID: id,
		URL: url,
		Cross: cross,
		Mine: mine.has(id),
		LYou: ln.Common.Posts["you"],
	}).render()
}

// Renders readable elapsed time since post. Numbers are in seconds.
export function relativeTime(then: number): string {
	const now = Math.floor(Date.now() / 1000)
	let time = Math.floor((now - then) / 60),
		isFuture = false
	if (time < 1) {
		if (time > -5) { // Assume to be client clock imprecision
			return ln.Common.Posts["justNow"]
		} else {
			isFuture = true
			time = -time
		}
	}

	const divide = [60, 24, 30, 12],
		unit = ['minute', 'hour', 'day', 'month']
	for (let i = 0; i < divide.length; i++) {
		if (time < divide[i]) {
			return ago(time, ln.Common.Plurals[unit[i]], isFuture)
		}
		time = Math.floor(time / divide[i])
	}

	return ago(time, ln.Common.Plurals["year"], isFuture)
}

// Renders "56 minutes ago" or "in 56 minutes" like relative time text.
function ago(time: number, units: [string], isFuture: boolean): string {
	const count = `${time} ${pluralize(time, units)}`
	return isFuture
		? `${ln.Common.Posts["in"]} ${count}`
		: `${count} ${ln.Common.Posts["ago"]}`
}
