/**
 * Various page scrolling helpers.
 */

// Scroll to the top of the page.
export function scrollToTop() {
	window.scrollTo(0, 0)
}

// Scroll to the bottom of the thread.
export function scrollToBottom() {
	window.scrollTo(0, document.documentElement.scrollHeight)
}
