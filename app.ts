/**
 * Application entry point.
 */

// tslint:disable-next-line:no-reference
/// <reference path="ts/util/dom4.d.ts" />

import { init as initAlerts, showAlert } from "./ts/alerts";
import { init as initHandlers } from "./ts/client";
import { init as initConnection } from "./ts/connection";
import { init as initDB } from "./ts/db";
import { ln } from "./ts/lang";
import { init as initModeration } from "./ts/mod";
import { init as initOptions } from "./ts/options";
import { extractConfigs, renderBoard, renderThread } from "./ts/page";
import { init as initPosts } from "./ts/posts";
import { page } from "./ts/state";
import { init as initUI } from "./ts/ui";

// Load all stateful modules in dependency order.
async function init() {
  extractConfigs();
  await initDB();

  initAlerts();
  initOptions();

  if (!page.landing) {
    if (page.thread) {
      await renderThread();
      initConnection();
      initHandlers();
    } else {
      await renderBoard();
    }
  }

  if (!page.landing && !page.catalog) {
    initPosts();
  }

  initUI();
  initModeration();
}

init().catch((err) => {
  // tslint:disable-next-line:no-console
  console.error(err);
  showAlert({
    message: err.message,
    sticky: true,
    title: ln.UI.initErr,
  });
});
