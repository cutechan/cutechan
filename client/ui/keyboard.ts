// Keyboard shortcuts and such

import { POST_SEL, BOARD_SEARCH_INPUT_SEL } from "../vars"
import options from "../options"
import { page } from "../state"
import { getID, trigger, HOOKS } from "../util"

// Bind keyboard event listener to the document
export default () =>
	document.addEventListener("keydown", handleShortcut)

function handleShortcut(event: KeyboardEvent) {
	let caught = false

	let anyModifier = event.altKey || event.metaKey || event.ctrlKey || event.shiftKey;
	let inInput = 'selectionStart' in event.target

	if (!anyModifier && !inInput) {
		caught = true
		switch (event.key) {
			case "ArrowLeft":
				navigatePost(true)
				break
			case "ArrowRight":
				navigatePost(false)
				break
			case "s":
				navigateSearch()
				break
			default:
				caught = false
		}
	}

	if (event.altKey) {
		caught = true
		switch (event.which) {
			case options.newPost:
				trigger(HOOKS.openReply)
				break
			case options.workMode:
				options.workModeToggle = !options.workModeToggle
				break
			case 38:
				navigateUp()
				break
			default:
				caught = false
		}
	}

	if (caught) {
		event.stopImmediatePropagation()
		event.preventDefault()
	}
}

// Navigate one level up the board tree, if possible
function navigateUp() {
	let url: string
	if (page.thread) {
		url = `/${page.board}/`
	} else if (page.board !== "all") {
		url = "/all/"
	}
	if (url) {
		location.href = url
	}
}

// Move focus to next or previous visible post in document order.
// Starts with first post if none is selected via current url fragment.
function navigatePost(reverse: boolean) {
	const all = Array.from(document.querySelectorAll(POST_SEL))
	const currentId = location.hash.slice(1)
	let current = document.getElementById("post" + currentId) || all[0]
	let currentIdx = all.indexOf(current)

	while (current) {
		currentIdx = reverse ? currentIdx - 1 : currentIdx + 1
		current = all[currentIdx]
		if (current && getComputedStyle(current).display !== "none") {
			break
		}
	}

	if (current) {
		location.hash = "#" + getID(current)
	}
}

function navigateSearch() {
	const el = document.querySelector(BOARD_SEARCH_INPUT_SEL)
	if (el) {
		el.focus()
	}
}
