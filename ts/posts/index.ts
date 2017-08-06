export { Thread, Post, Backlinks } from "./model";
export { default as PostView } from "./view";
export { thumbPath, sourcePath } from "./images";
export { default as PostCollection } from "./collection";

import { copyToClipboard, on } from "../util";
import { POST_FILE_TITLE_SEL } from "../vars";
import { init as initHover } from "./hover";
import { init as initPopup } from "./popup";
import { init as initReplyForm } from "./reply-form";

function initFileTitle() {
  on(document, "click", (e) => {
    const title = (e.target as HTMLElement).textContent;
    copyToClipboard(title);
  }, {selector: POST_FILE_TITLE_SEL});
}

export function init() {
  initReplyForm();
  initHover();
  initPopup();
  initFileTitle();
}
