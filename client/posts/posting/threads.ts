import { on } from '../../util'
import { CaptchaView } from "../../ui"

function expand(e: Event) {
	const el = document.getElementById("new-thread-form") as HTMLElement
	el.style.display = "block"
	const c = el.querySelector(".captcha-container")
	if (c) {
		new CaptchaView(c)
	}
}

export default () =>
	on(document.getElementById("threads"), "click", expand, {
		selector: ".new-thread-button",
		passive: true,
	})
