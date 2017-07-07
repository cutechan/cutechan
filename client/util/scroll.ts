/**
 * Various page scrolling helpers.
 */

const banner = document.getElementById("banner")

// Scroll to particular element and compensate for the banner height.
export function scrollToElement(el: HTMLElement) {
	window.scrollTo(0, el.offsetTop - banner.offsetHeight - 5)
}

// Scroll to the top of the page.
export function scrollToTop() {
	document.body.scrollTop = document.documentElement.scrollTop = 0
}

// Scroll to the bottom of the thread.
export function scrollToBottom() {
	window.scrollTo(0, document.documentElement.scrollHeight)
}
