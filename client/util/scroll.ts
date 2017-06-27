// Various page scrolling aids

import { page } from "../state"

const banner = document.getElementById("banner")

// Indicates if the page is scrolled to its bottom
export let atBottom: boolean

// Scroll to particular element and compensate for the banner height
export function scrollToElement(el: HTMLElement) {
	window.scrollTo(0, el.offsetTop - banner.offsetHeight - 5)
}

// Scroll to the bottom of the thread
export function scrollToBottom() {
	window.scrollTo(0, document.documentElement.scrollHeight)
	atBottom = true
}

// Check, if at the bottom of the thread and render the locking indicator
export function checkBottom() {
	if (!page.thread) {
		atBottom = false
		return
	}
	atBottom = isAtBottom()
}

function isAtBottom(): boolean {
	return window.innerHeight + window.scrollY
		>= document.documentElement.offsetHeight
}
