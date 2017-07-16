/**
 * Tab title and favicon rendering.
 */

import { connSM, connState } from "../connection"
import { Post } from "../posts"
import { posts } from "../state"

const faviconEl = document.getElementById("favicon")
const urlBase = "/static/favicons/"
const baseTitle = document.title
let queue = [] as [Post]

// All possible favicon states.
const enum states { default, disconnected, error, unread, replied }

// Last state rendered as a favicon. Used to reduce DOM & tab header
// writes.
const lastRendered = {
	state: states.default,
	unseenPosts: 0,
}

let unseenPosts = 0
let unseenReplies = false
let recalcPending = false
let discoFavicon = ""

function processQueue() {
	for (const post of queue) {
		if (!post.seen()) {
			unseenPosts += 1
		}
	}
	queue = [] as any
	resolve()
}

// Recalculate unseen post status.
function recalc() {
	unseenPosts = 0
	unseenReplies = false
	recalcPending = false
	for (const post of posts) {
		if (post.seen()) continue
		unseenPosts += 1
		if (post.isReply()) {
			unseenReplies = true
		}
	}
	resolve()
}

// Resolve tab title and favicon.
function resolve() {
	let prefix = ""
	let state = states.default
	if (connSM.state === connState.desynced) {
		prefix = "--- "
		state = states.error
	} else if (connSM.state === connState.dropped) {
		prefix = "--- "
		state = states.disconnected
	} else {
		if (unseenPosts) {
			prefix = `(${unseenPosts}) `
			state = states.unread
		}
		if (unseenReplies) {
			prefix = ">> " + prefix
			state = states.replied
		}
	}
	apply(prefix, state)
}

// Write tab title and favicon to DOM.
function apply(prefix: string, state: states) {
	// Same data - skip write to DOM.
	if (lastRendered.state === state
			&& lastRendered.unseenPosts === unseenPosts) {
		return
	}
	lastRendered.unseenPosts = unseenPosts
	lastRendered.state = state

	document.title = prefix + baseTitle
	let url = urlBase
	switch (state) {
	case states.default:
		url += "default.ico"
		break
	case states.unread:
		url += "unread.ico"
		break
	case states.replied:
		url += "reply.ico"
		break
	case states.error:
		url += "error.ico"
		break
	case states.disconnected:
		url = discoFavicon
		break
	}
	faviconEl.setAttribute("href", url)
}

// Account for immediate reconnection and only render favicon, if not
// reconnected in few seconds.
function delayedDiscoRender() {
	setTimeout(() => {
		if (connSM.state === connState.dropped
				|| connSM.state === connState.desynced) {
			resolve()
		}
	}, 5000)
}

// Needs to be available with no connectivity, so we store it
// beforehand.
function cacheDiscoFavicon() {
	fetch(urlBase + "error.ico")
		.then(res => res.blob())
		.then(blob => discoFavicon = URL.createObjectURL(blob))
}

function onScroll() {
	if (recalcPending || document.hidden) return
	recalcPending = true
	setTimeout(recalc, 200)
}

export function init() {
	cacheDiscoFavicon()

	connSM.on(connState.synced, resolve)
	connSM.on(connState.dropped, delayedDiscoRender)
	connSM.on(connState.desynced, delayedDiscoRender)

	document.addEventListener("scroll", onScroll, { passive: true })
	document.addEventListener("visibilitychange", onScroll)
}

// Update unseen post count based on post visibility and scroll
// position.
export function postAdded(post: Post) {
	// Async batch processing since visibility calculations force a
	// layout.
	if (!queue.length) {
		// Can't use RAF since it's disabled in background tabs.
		setTimeout(processQueue, 16)
	}
	queue.push(post)
}

// Add unseen reply indicator to tab header.
export function repliedToMe(post: Post) {
	if (!post.seen()) {
		unseenReplies = true
		resolve()
	}
}
