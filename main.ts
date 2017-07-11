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
import { ln } from "./client/lang"
import { page } from "./client/state"
import { extractConfigs, renderThread, renderBoard } from "./client/page"

// Load all stateful modules in dependency order.
async function init() {
	extractConfigs()
	await initDB()

	initAlerts()
	initOptions()

	if (page.thread) {
		await renderThread()
		initConnection()
		initHandlers()
	} else {
		await renderBoard()
	}

	if (!page.catalog) {
		initPosts()
	}

	initUI()
	initModeration()
}

init().catch(err => {
	console.error(err)
	showAlert({
		sticky: true,
		title: ln.UI.initErr,
		message: err.message,
	})
})
