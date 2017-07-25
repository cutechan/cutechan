/**
 * Expand media attachments to the middle of the screen.
 */

import { TRIGGER_MEDIA_POPUP_SEL, ZOOM_STEP_PX, HEADER_HEIGHT_PX } from "../vars"
import { getModel } from "../state"
import { Post } from "./model"
import { on, trigger, HOOKS } from "../util"

let opened = 0
let lastUrl = ""

class Popup {
	private post = null as Post
	private el = null as HTMLElement
	private itemEl = null as HTMLVideoElement
	private url = ""
	private aspect = 0
	private moving = false
	private baseX = 0
	private baseY = 0
	private startX = 0
	private startY = 0

	constructor(post: Post) {
		this.post = post
		this.url = post.fileSrc
		if (this.url === lastUrl) return
		lastUrl = this.url

		let w = post.image.dims[0]
		let h = post.image.dims[1]
		this.aspect = w / h
		const pW = document.body.clientWidth
		const pH = window.innerHeight - HEADER_HEIGHT_PX
		w = Math.min(w, pW)
		h = Math.ceil(w / this.aspect)
		if (h > pH) {
			h = pH
			w = Math.ceil(h * this.aspect)
		}
		const l = (pW - w) / 2
		const t = (pH - h) / 2 + HEADER_HEIGHT_PX

		this.el = document.createElement("div")
		this.el.className = "media-popup"
		this.el.style.left = l + "px"
		this.el.style.top = t + "px"

		if (post.image.video) {
			this.itemEl = document.createElement("video") as any
			this.itemEl.loop = true
			this.itemEl.autoplay = true
			this.itemEl.controls = !post.transparentThumb
			// media.volume = Settings.get("volume")
			// media.addEventListener("volumechange", function() {
			//	 Settings.set("volume", media.volume)
			// })
		} else {
			this.itemEl = document.createElement("img") as any
		}
		this.itemEl.src = this.url
		this.itemEl.width = w
		this.itemEl.className = "media-popup-item"
		this.el.appendChild(this.itemEl)

		this.attach()
	}
	isControlsClick = (e: MouseEvent) => {
		if (!this.post.image.video || this.post.transparentThumb) return false
		// <https://stackoverflow.com/a/22928167>.
		const ctrlHeight = 50
		const rect = this.itemEl.getBoundingClientRect()
		const relY = e.clientY - rect.top
		return relY > rect.height - ctrlHeight
	}
	handleClick = (e: MouseEvent) => {
		// if (!Settings.get("popupBackdrop")) return
		if (e.target !== this.itemEl) {
			this.detach()
		}
	}
	handleKey = (e: KeyboardEvent) => {
		if (e.keyCode === 27) {
			this.detach()
		}
	}
	handleMediaClick = (e: MouseEvent) => {
		if (!this.isControlsClick(e)) {
			e.preventDefault()
		}
	}
	handleMediaDrag = (e: DragEvent) => {
		e.preventDefault()
	}
	handlePopupMouseDown = (e: MouseEvent) => {
		this.moving = true
		this.baseX = e.clientX
		this.baseY = e.clientY
		this.startX = this.el.offsetLeft
		this.startY = this.el.offsetTop
	}
	handleMouseMove = (e: MouseEvent) => {
		if (this.moving) {
			this.el.style.left = (this.startX + e.clientX - this.baseX) + "px"
			this.el.style.top = (this.startY + e.clientY - this.baseY) + "px"
		}
	}
	handlePopupMouseUp = (e: MouseEvent) => {
		this.moving = false
		if (e.button === 0
				&& e.clientX === this.baseX
				&& e.clientY === this.baseY
				&& !this.isControlsClick(e)) {
			this.detach()
		}
	}
	handlePopupWheel = (e: WheelEvent) => {
		e.preventDefault()
		const order = e.deltaY < 0 ? 1 : -1
		let w = this.itemEl.width
		if (w <= 50 && order < 0) return
		w = Math.max(50, w + ZOOM_STEP_PX * order)
		this.itemEl.width = w
		const l = this.el.offsetLeft - (ZOOM_STEP_PX / 2) * order
		const t = this.el.offsetTop - (ZOOM_STEP_PX / this.aspect / 2) * order
		this.el.style.left = l + "px"
		this.el.style.top = t + "px"
	}
	attach() {
		document.body.appendChild(this.el)
		document.addEventListener("click", this.handleClick)
		document.addEventListener("keydown", this.handleKey)
		document.addEventListener("mousemove", this.handleMouseMove)
		this.itemEl.addEventListener("click", this.handleMediaClick)
		this.itemEl.addEventListener("dragstart", this.handleMediaDrag)
		this.el.addEventListener("mousedown", this.handlePopupMouseDown)
		this.el.addEventListener("mouseup", this.handlePopupMouseUp)
		this.el.addEventListener("wheel", this.handlePopupWheel)
		opened += 1
		trigger(HOOKS.openPostPopup)
	}
	detach() {
		document.removeEventListener("mousemove", this.handleMouseMove)
		document.removeEventListener("keydown", this.handleKey)
		document.removeEventListener("click", this.handleClick)
		this.el.remove()
		if (this.url === lastUrl) lastUrl = ""
		opened -= 1
	}
}

function open(e: MouseEvent) {
	if (e.button !== 0) return

	const post = getModel(e.target as Element)
	if (!post) return

	e.preventDefault()
	new Popup(post)
}

export function isOpen(): boolean {
	return opened > 0
}

export function init() {
	on(document, "click", open, {
		selector: TRIGGER_MEDIA_POPUP_SEL,
	})
}
