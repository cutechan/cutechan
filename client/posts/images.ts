import { Post } from "./model"
import { fileTypes } from "../common"
import { View } from "../base"
import { setAttrs, on, firstChild, importTemplate, pad } from "../util"
import options from "../options"
import { getModel, config } from "../state"
import lang from "../lang"

// Mixin for image expansion and related functionality
export default class ImageHandler extends View<Post> {
	// Render the figure and figcaption of a post. Set reveal to true, if in
	// hidden thumbnail mode, to reveal the thumbnail.
	public renderImage(reveal: boolean) {
		this.el.classList.add("media")

		let el = this.getFigure()
		if (!el) {
			el = importTemplate("figure").firstChild as HTMLElement
			this.el.querySelector(".post-container").prepend(el)
		}

		const showThumb = !options.workModeToggle || reveal
		el.hidden = !showThumb
		if (showThumb) {
			(el.firstElementChild as HTMLElement).hidden = false
			this.renderThumbnail()
		}
		this.renderFigcaption(reveal)
	}

	// Need to find direct descendant, otherwise inlined posts might match
	private getFigure(): HTMLElement {
		return firstChild(this.el.querySelector(".post-container"), ch =>
			ch.tagName === "FIGURE")
	}

	// Need to find direct descendant, otherwise inlined posts might match
	private getFigcaption(): HTMLElement {
		return firstChild(this.el, ch =>
			ch.tagName === "FIGCAPTION")
	}

	public removeImage() {
		this.el.classList.remove("media")
		let el = this.getFigure()
		if (el) {
			el.remove()
		}
		el = this.getFigcaption()
		if (el) {
			el.remove()
		}
	}

	// Render the actual thumbnail image
	private renderThumbnail() {
		const el = this.el.querySelector("figure a"),
			data = this.model.image,
			src = sourcePath(data.SHA1, data.fileType)
		let thumb: string,
			[, , thumbWidth, thumbHeight] = data.dims

		if (data.spoiler && options.spoilers) {
			// Spoilered and spoilers enabled
			thumb = '/static/img/spoiler.jpg'
			thumbHeight = thumbWidth = 150
		} else {
			thumb = thumbPath(data.SHA1, data.thumbType)
		}

		// Downscale thumbnail for higher DPI, unless specified not to
		if (!data.large && (thumbWidth > 125 || thumbHeight > 125)) {
			thumbWidth *= 0.8333
			thumbHeight *= 0.8333
		}

		el.setAttribute("href", src)
		setAttrs(el.firstElementChild, {
			src: thumb,
			width: thumbWidth.toString(),
			height: thumbHeight.toString(),
			class: "", // Remove any existing classes
		})
	}

	// Render the information caption above the image
	private renderFigcaption(reveal: boolean) {
		let el = this.getFigcaption()
		if (!el) {
			el = importTemplate("figcaption").firstChild as HTMLElement
			this.el.querySelector("header").after(el)
		}

		const [hToggle, info] = Array.from(el.children) as HTMLElement[]
		if (!options.workModeToggle) {
			hToggle.hidden = true
		} else {
			hToggle.hidden = false
			hToggle.textContent = lang.posts[reveal ? 'hide' : 'show']
		}

		const data = this.model.image
		for (let el of Array.from(info.children) as HTMLElement[]) {
			switch (el.className) {
				case "media-title":
					el.textContent = data.title
					break;
				case "media-artist":
					el.textContent = data.artist
					break
				case "has-audio":
					el.hidden = !data.audio
					break
				case "media-length":
					const len = data.length
					if (len) {
						let s: string
						if (len < 60) {
							s = `0:${pad(len)}`
						} else {
							const min = Math.floor(len / 60),
								sec = len - min * 60
							s = `${pad(min)}:${pad(sec)}`
						}
						el.textContent = s
					}
					break
				case "is-apng":
					el.hidden = !data.apng
					break
				case "filesize":
					const { size } = data
					let s: string
					if (size < (1 << 10)) {
						s = size + ' B'
					} else if (size < (1 << 20)) {
						s = Math.round(size / (1 << 10)) + ' KB'
					} else {
						const text = Math.round(size / (1 << 20) * 10)
							.toString()
						s = `${text.slice(0, -1)}.${text.slice(-1)} MB`
					}
					el.textContent = s
					break
				case "dims":
					el.textContent = `${data.dims[0]}x${data.dims[1]}`
					break
			}
		}

		el.hidden = false
	}
}

function imageRoot(): string {
	return config.imageRootOverride || "/uploads"
}

// Get the thumbnail path of an image, accounting for not thumbnail of specific
// type being present
export function thumbPath(SHA1: string, thumbType: fileTypes): string {
	return `${imageRoot()}/thumb/${SHA1}.${fileTypes[thumbType]}`
}

// Resolve the path to the source file of an upload
export function sourcePath(SHA1: string, fileType: fileTypes): string {
	return `${imageRoot()}/src/${SHA1}.${fileTypes[fileType]}`
}

// Reveal/hide thumbnail by clicking [Show]/[Hide] in hidden thumbnail mode
function toggleHiddenThumbnail(event: Event) {
	const model = getModel(event.target as Element)
	if (!model) {
		return
	}
	const { revealed } = model.image
	model.view.renderImage(!revealed)
	model.image.revealed = !revealed
}

on(document, "click", toggleHiddenThumbnail, {
	passive: true,
	selector: ".image-toggle",
})
