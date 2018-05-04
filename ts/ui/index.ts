export { default as FormView } from "./forms";
export { postAdded } from "./tab";
export { default as notifyAboutReply, OverlayNotification } from "./notification";

import { page } from "../state";
import FAQPanel from "./faq";
import { init as initKeyboard } from "./keyboard";
import { init as initNav } from "./nav";
import OptionPanel from "./options";
import { init as initTab } from "./tab";

export function init() {
  initKeyboard();
  initNav();
  if (page.thread) {
    initTab();
  }
  // tslint:disable-next-line:no-unused-expression
  new FAQPanel();
  // tslint:disable-next-line:no-unused-expression
  new OptionPanel();
}
