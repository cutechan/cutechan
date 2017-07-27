/**
 * Application entry point.
 */

/// <reference path="ts/util/dom4.d.ts" />

import { init as initDB } from "./ts/db"
import { init as initAlerts, showAlert } from "./ts/alerts"
import { init as initOptions } from "./ts/options"
import { init as initConnection } from "./ts/connection"
import { init as initHandlers } from "./ts/client"
import { init as initPosts } from "./ts/posts"
import { init as initUI } from "./ts/ui"
import { init as initModeration } from "./ts/mod"
import { ln } from "./ts/lang"
import { page } from "./ts/state"
import { extractConfigs, renderThread, renderBoard } from "./ts/page"

// Load all stateful modules in dependency order.
async function init() {
  extractConfigs()
  await initDB()

  initAlerts()
  initOptions()

  if (!page.landing) {
    if (page.thread) {
      await renderThread()
      initConnection()
      initHandlers()
    } else {
      await renderBoard()
    }
  }

  if (!page.landing && !page.catalog) {
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
