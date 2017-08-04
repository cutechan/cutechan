export { Thread, Post, Backlinks } from "./model";
export { default as PostView } from "./view";
export { getPostModel, postEvent, postSM, postState, FormModel } from "./posting";
export { thumbPath, sourcePath } from "./images";
export { default as PostCollection } from "./collection";

import { copyToClipboard, on } from "../util";
import { POST_FILE_TITLE_SEL } from "../vars";
import { init as initHover } from "./hover";
import { init as initPopup } from "./popup";
import { init as initPosting } from "./posting";

function initFileTitle() {
  on(document, "click", (e) => {
    const title = (e.target as HTMLElement).textContent;
    copyToClipboard(title);
  }, {selector: POST_FILE_TITLE_SEL});
}

export function init() {
  initPosting();
  initHover();
  initPopup();
  initFileTitle();
}
