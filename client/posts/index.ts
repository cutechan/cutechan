export { Thread, Post, Backlinks } from "./model"
export { default as PostView } from "./view"
export { getPostModel, postEvent, postSM, postState, FormModel } from "./posting"
export {
	default as ImageHandler,
	duration, fileSize, thumbPath, sourcePath,
} from "./images"
export * from "./render"
export { default as PostCollection } from "./collection"
export { findSyncwatches } from "./syncwatch"

import initEtc from "./etc"
import initPosting from "./posting"
import initMenu from "./menu"
import initHover from "./hover"

export function init() {
	initEtc()
	initPosting()
	initMenu()
	initHover()
}
