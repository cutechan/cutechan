/**
 * Client entry point.
 */

/// <reference path="client/util/dom4.d.ts" />

import { loadFromDB, page, storeMine, displayLoading } from "./client/state"
import { start as connect } from "./client/connection"
import { open } from "./client/db"
import { initOptions } from "./client/options"
import initPosts from "./client/posts"
import { renderBoard, extractConfigs, renderThread } from "./client/page"
import initUI from "./client/ui"
import { getCookie, deleteCookie } from "./client/util"
import assignHandlers from "./client/client"
import initModeration from "./client/mod"

// Load all stateful modules in dependency order
async function start() {
	extractConfigs()

	await open()
	if (page.thread) {
		await loadFromDB(page.thread)

		// Add a stored thread OP, made by the client to "mine"
		const addMine = getCookie("addMine")
		if (addMine) {
			const id = parseInt(addMine)
			storeMine(id, id)
			deleteCookie("addMine")
		}
	}

	initOptions()

	if (page.thread) {
		renderThread()
		connect()
		// checkBottom()
		assignHandlers()
	} else {
		await renderBoard()
		displayLoading(false)
	}

	initPosts()
	initUI()
	initModeration()
}

start().catch(err => {
	alert(err.message)
	throw err
})
