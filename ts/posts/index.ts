export { Thread, Post, Backlinks } from "./model"
export { default as PostView } from "./view"
export { getPostModel, postEvent, postSM, postState, FormModel } from "./posting"
export { thumbPath, sourcePath } from "./images"
export { default as PostCollection } from "./collection"

import { POST_FILE_TITLE_SEL } from "../vars"
import { on, copyToClipboard } from "../util"
import { init as initPosting } from "./posting"
import { init as initHover } from "./hover"
import { init as initPopup } from "./popup"

function initFileTitle() {
  on(document, "click", e => {
    const title = (e.target as HTMLElement).textContent
    copyToClipboard(title)
  }, {selector: POST_FILE_TITLE_SEL})
}

export function init() {
  initPosting()
  initHover()
  initPopup()
  initFileTitle()
}
