export { default as FormView } from "./forms"
export { postAdded } from "./tab"
export { default as notifyAboutReply, OverlayNotification } from "./notification"
export { default as CaptchaView } from "./captcha"
import { BannerModal } from "../base"

import initKeyboard from "./keyboard"
import initTab from "./tab"
import OptionPanel from "./options"

export function init() {
	initKeyboard()
	initTab()
	new OptionPanel()
	new BannerModal(document.getElementById("FAQ"))
}
