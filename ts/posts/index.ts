export { Thread, Post, Backlinks } from "./model";
export { default as PostView } from "./view";
export { getFilePrefix, thumbPath, sourcePath } from "./images";
export { default as PostCollection } from "./collection";
export { isOpen as isHoverActive } from "./hover";

import options from "../options";
import { page, posts } from "../state";
import { copyToClipboard, on } from "../util";
import { RELATIVE_TIME_PERIOD_SECS } from "../vars";
import { POST_FILE_TITLE_SEL } from "../vars";
import { init as initHover } from "./hover";
import { init as initPopup } from "./popup";
import { init as initReply } from "./reply";

/** Rerender all post timestamps. */
function renderTime() {
  for (const { view } of posts) {
    view.renderTime();
  }
}

function initRenderTime() {
  options.onChange("relativeTime", renderTime);
  setInterval(() => {
    if (options.relativeTime) {
      renderTime();
    }
  }, RELATIVE_TIME_PERIOD_SECS * 1000);
}

function initFileTitle() {
  on(document, "click", (e) => {
    const title = (e.target as HTMLElement).textContent;
    copyToClipboard(title);
  }, {selector: POST_FILE_TITLE_SEL});
}

export function init() {
  if (!page.catalog) {
    initRenderTime();
  }
  initFileTitle();
  initReply();
  initHover();
  initPopup();
}
