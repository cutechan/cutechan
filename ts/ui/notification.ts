import { storeSeenReply, seenReplies } from "../state"
import options from "../options"
import lang from "../lang"
import { thumbPath, Post } from "../posts"
import { repliedToMe } from "./tab"
import { importTemplate } from "../util"
import { View } from "../base"
import { DEFAULT_NOTIFICATION_IMAGE_URL } from "../vars"

// Notify the user that one of their posts has been replied to
export default function notifyAboutReply(post: Post) {
	if (seenReplies.has(post.id)) {
		return
	}
	storeSeenReply(post.id, post.op)
	if (!document.hidden) {
		return
	}
	repliedToMe(post)

	if (!options.notification
		|| typeof Notification !== "function"
		|| (Notification as any).permission !== "granted"
	) {
		return
	}

	let icon: string
	if (!options.workModeToggle) {
		if (post.image) {
			const { thumbType, SHA1 } = post.image
			icon = thumbPath(thumbType, SHA1)
		} else {
			icon = DEFAULT_NOTIFICATION_IMAGE_URL
		}
	}
	const n = new Notification(lang.ui["quoted"], {
		icon,
		body: post.body,
		vibrate: true,
	})
	n.onclick = () => {
		n.close()
		window.focus()
		location.hash = "#" + post.id
	}
}

// Textual notification at the top of the page
// TODO(Kagami): Rework.
export class OverlayNotification extends View<null> {
	constructor(text: string) {
		super({ el: importTemplate("notification").firstChild as HTMLElement })
		this.on("click", () =>
			this.remove())
		this.el.querySelector("b").textContent = text
		// overlay.prepend(this.el)
	}
}
