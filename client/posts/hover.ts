/**
 * Post and image hover previews.
 */

import { posts } from "../state"
import options from "../options"
import API from "../api"
import { Post } from "./model"
import PostView from "./view"
import { View } from "../base"
import * as popup from "./popup"
import { getClosestID, emitChanges, ChangeEmitter, HOOKS, hook } from "../util"

interface MouseMove extends ChangeEmitter {
	event: MouseEvent
}

const overlay = document.querySelector("#hover-overlay")

// Currently displayed preview, if any.
let postPreview = null as PostPreview
let imagePreview = null as HTMLElement

// Centralized mousemove target tracking.
const mouseMove = emitChanges<MouseMove>({
	event: {
		target: null,
	},
} as MouseMove)

// Post hover preview view.
class PostPreview extends View<Post> {
	public el: HTMLElement
	private clickHandler: EventListener
	private parent: HTMLElement
	private source: HTMLElement
	private sourceModel: Post

	constructor(model: Post, parent: HTMLElement) {
		const { el } = model.view
		super({ el: clonePost(el) })
		this.source = el
		this.parent = parent
		this.sourceModel = model
		this.model = Object.assign({}, model)

		this.clickHandler = () => {
			this.remove()
		}
		parent.addEventListener("click", this.clickHandler)

		this.render()
	}

	private render() {

		// Underline reverse post links in preview.
		const patt = new RegExp(`[>\/]` + getClosestID(this.parent))
		for (let el of this.el.querySelectorAll("a.post-link")) {
			if (!patt.test(el.textContent)) continue
			el.classList.add("referenced")
		}

		const fc = overlay.firstChild
		if (fc !== this.el) {
			if (fc) {
				fc.remove()
			}
			overlay.append(this.el)
		}

		this.position()
	}

	// Position the preview element relative to it's parent link.
	private position() {
		const rect = this.parent.getBoundingClientRect()

		// The preview will never take up more than 100% screen width, so no
		// need for checking horizontal overflow. Must be applied before
		// reading the height, so it takes into account post resizing to
		// viewport edge.
		this.el.style.left = rect.left + "px"

		const height = this.el.offsetHeight
		let top = rect.top - height - 5

		// If post gets cut off at the top, put it bellow the link.
		if (top < 0) {
			top += height + 23
		}
		this.el.style.top = top + "px"
	}

	// Remove this view.
	public remove() {
		this.parent.removeEventListener("click", this.clickHandler)
		postPreview = null
		super.remove()
	}
}

// Clear any previews.
function clear() {
	if (postPreview) {
		postPreview.remove()
		postPreview = null
	}
	if (imagePreview) {
		imagePreview.remove()
		imagePreview = null
	}
}

// Clone a post element as a preview.
function clonePost(el: HTMLElement): HTMLElement {
	const preview = el.cloneNode(true) as HTMLElement
	preview.removeAttribute("id")
	preview.classList.add("preview")
	return preview
}

function renderImagePreview(event: MouseEvent) {
	if (!options.imageHover) return
	if (popup.isOpen()) return

	const target = event.target as HTMLElement
	const bypass = target.tagName !== "IMG"
	if (bypass) {
		if (imagePreview) {
			imagePreview.remove()
			imagePreview = null
		}
		return
	}

	const link = target.closest("a")
	if (!link) return
	const src = link.getAttribute("href")
	const ext = src.slice(src.lastIndexOf(".") + 1)

	let tag = ""
	switch (ext) {
	case "jpg":
	case "png":
	case "gif":
		tag = "img"
		break
	default:
		clear()
		return
	}

	const el = document.createElement(tag) as HTMLImageElement
	el.src = src
	imagePreview = el
	overlay.append(el)
}

async function renderPostPreview(event: MouseEvent) {
	let target = event.target as HTMLElement
	if (!target.matches || !target.matches("a.post-link")) return
	if (target.matches("em.expanded > a")) return
	const id = parseInt(target.getAttribute("data-id"))
	if (!id) return

	let post = posts.get(id)
	if (!post) {
		// Try to fetch from server, if this post is not currently displayed
		// due to lastN or in a different thread.
		const data = await API.post.get(id)
		post = new Post(data)
		new PostView(post, null)
	}
	postPreview = new PostPreview(post, target)
}

// Bind mouse movement event listener.
function onMouseMove(event: MouseEvent) {
	if (event.target !== mouseMove.event.target) {
		clear()
		mouseMove.event = event
	}
}

export default () => {
	document.addEventListener("mousemove", onMouseMove, {
		passive: true,
	})
	mouseMove.onChange("event", renderPostPreview)
	mouseMove.onChange("event", renderImagePreview)

	hook(HOOKS.openPostPopup, clear)
}
