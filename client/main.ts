// Client entry point

/// <reference path="util/dom4.d.ts" />

import { loadFromDB, page, storeMine, displayLoading } from './state'
import { start as connect } from './connection'
import { open } from './db'
import { initOptions } from "./options"
import initPosts from "./posts"
import { renderBoard, extractConfigs, renderThread } from './page'
import initUI from "./ui"
import { checkBottom, getCookie, deleteCookie } from "./util"
import assignHandlers from "./client"
import initModeration from "./mod"

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
		checkBottom()
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
