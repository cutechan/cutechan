import { ThreadData } from "../common"
import { findSyncwatches } from "../posts"
import { page, loadFromDB } from "../state"
import { isBanned, extractPost, reparseOpenPosts, extractPageData } from "./common"

const threads = document.getElementById("threads")

// Render the HTML of a thread page
export async function render() {
	if (isBanned()) {
		return
	}

	await loadFromDB(page.thread)

	const { threads: data, backlinks } = extractPageData<ThreadData>(),
		{ posts } = data

	data.posts = null

	extractPost(data, data.id, data.board, backlinks)

	for (let post of posts) {
		extractPost(post, data.id, data.board, backlinks)
	}
	reparseOpenPosts()
	findSyncwatches(threads)
}
