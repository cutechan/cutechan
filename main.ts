/**
 * Client entry point.
 */

/// <reference path="client/util/dom4.d.ts" />

import { init as initDB } from "./client/db"
import { init as initAlerts, showAlert } from "./client/alerts"
import { init as initOptions } from "./client/options"
import { init as initConnection } from "./client/connection"
import { init as initHandlers } from "./client/client"
import { init as initPosts } from "./client/posts"
import { init as initUI } from "./client/ui"
import { init as initModeration } from "./client/mod"
import { renderBoard, extractConfigs, renderThread } from "./client/page"
import { loadFromDB, page, storeMine } from "./client/state"
import { getCookie, deleteCookie } from "./client/util"
import { ln } from "./client/lang"

// Load all stateful modules in dependency order.
async function init() {
	extractConfigs()

	await initDB()
	if (page.thread) {
		await loadFromDB(page.thread)
		// Add a stored thread OP, made by the client to "mine".
		const addMine = getCookie("addMine")
		if (addMine) {
			const id = parseInt(addMine)
			storeMine(id, id)
			deleteCookie("addMine")
		}
	}

	initAlerts()
	initOptions()

	if (page.thread) {
		renderThread()
		initConnection()
		initHandlers()
	} else {
		await renderBoard()
	}

	initPosts()
	initUI()
	initModeration()
}

init().catch(({ message }) => {
	showAlert({
		message,
		title: ln.UI.initErr,
		sticky: true,
	})
})
