export { Thread, Post, Backlinks } from "./model"
export { default as PostView } from "./view"
export { getPostModel, postEvent, postSM, postState, FormModel } from "./posting"
export { thumbPath, sourcePath } from "./images"
export * from "./render"
export { default as PostCollection } from "./collection"
export { findSyncwatches } from "./syncwatch"

import initPosting from "./posting"
import initHover from "./hover"
import initPopup from "./popup"

export function init() {
	initPosting()
	initHover()
	initPopup()
}
