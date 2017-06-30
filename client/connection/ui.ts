import lang from "../lang"
import { syncStatus } from "./state"
import { handlers, message } from "./messages"

const syncEl = document.getElementById("sync-status")
const syncedCount = document.getElementById("sync-counter")

// Render connection status indicator
export function renderStatus(status: syncStatus) {
	syncEl.textContent = lang.sync[status]
}

// Set synced IP count to n
export function renderSyncCount(n: number) {
	syncedCount.textContent = n
		? `${lang.ui.reading}: ${n}`
		: ""
}

handlers[message.syncCount] = renderSyncCount
