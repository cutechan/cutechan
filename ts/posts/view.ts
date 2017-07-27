import { Thread, Post } from './model'
import { makeFrag, getID } from '../util'
import { parseBody, relativeTime, renderPostLink } from './render'
import { TemplateContext, makePostContext, readableTime } from "../templates"
import { View, ViewAttrs } from "../base"
import { findSyncwatches } from "./syncwatch"
import { ln } from "../lang"
import options from "../options"
import { THREAD_SEL, POST_BACKLINKS_SEL } from "../vars"

/**
 * Base post view class
 */
export default class PostView extends View<Post> {
	constructor(model: Post, el: HTMLElement | null) {
		const attrs: ViewAttrs = { model }

		const thread = new Thread()
		attrs.el = el || makePostContext(thread, model).renderNode()

		super(attrs)

		this.model.view = this
		if (!el) {
			this.afterRender()
		}
	}

	// Apply client-specific formatting to a post rendered server-side.
	public afterRender() {
		this.renderTime()
	}

	// Renders a time element. Can be either absolute or relative.
	public renderTime() {
		let text = readableTime(this.model.time)
		const el = this.el.querySelector("time")
		if (options.relativeTime) {
			el.setAttribute("title", text)
			text = relativeTime(this.model.time)
		}
		el.textContent = text
	}

	// Render links to posts linking to this post.
	public renderBacklinks() {
		const links = Object.keys(this.model.backlinks).map(id =>
			renderPostLink(+id, this.model.backlinks[id])
		)
		if (!links.length) return

		const html = new TemplateContext("post-backlinks", {
			LReplies: ln.Common.UI["replies"],
			Backlinks: links,
		}).render()

		const container = this.el.querySelector(POST_BACKLINKS_SEL)
		container.innerHTML = html
	}

	public removeThread() {
		this.el.closest(THREAD_SEL).remove()
	}

	// Render "USER WAS BANNED FOR THIS POST" message.
	// TODO(Kagami): Remove?
	public renderBanned() {
	}

	// Render the sticky status of a thread OP.
	// TODO(Kagami): Implement.
	public renderSticky() {
		// const old = this.el.querySelector(".sticky")
		// if (old) {
		// 	old.remove()
		// }
		// if (this.model.sticky) {
		// 	this.el
		// 		.querySelector(".mod-checkbox")
		// 		.after(importTemplate("sticky"))
		// }
	}

	// Inserts PostView back into the thread ordered by id.
	public reposition() {
		// Insert before first post with greater ID.
		const { id, op } = this.model,
			sec = document.querySelector(`section[data-id="${op}"]`)
		if (!sec) {
			return
		}
		for (let el of Array.from(sec.children)) {
			switch (el.tagName) {
				case "ARTICLE":
					if (getID(el) > id) {
						el.before(this.el)
						return
					}
					break
				case "ASIDE": // On board pages
					el.before(this.el)
					return
			}
		}
		// This post should be last or no posts in thread.
		sec.append(this.el)
	}

	// Check if we can see the post or have scrolled past it.
	public scrolledPast() {
		const rect = this.el.getBoundingClientRect()
		const viewW = document.body.clientWidth
		const viewH = document.body.clientHeight
		return rect.bottom < viewH && rect.left > 0 && rect.left < viewW
	}

	// Replace the current body with a reparsed fragment.
	public reparseBody() {
		const bq = this.el.querySelector("blockquote")
		bq.innerHTML = ""
		bq.append(makeFrag(parseBody(this.model)))
		if (this.model.state.haveSyncwatch) {
			findSyncwatches(this.el)
		}
	}
}
