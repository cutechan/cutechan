export { default as FormView } from "./forms";
export { postAdded } from "./tab";
export { default as notifyAboutReply, OverlayNotification } from "./notification";
export { default as CaptchaView } from "./captcha";

import { HeaderModal } from "../base";
import { init as initKeyboard } from "./keyboard";
import { init as initNav } from "./nav";
import OptionPanel from "./options";
import { init as initTab } from "./tab";

export function init() {
  initKeyboard();
  initTab();
  initNav();
  // tslint:disable-next-line:no-unused-expression
  new OptionPanel();
  // tslint:disable-next-line:no-unused-expression
  new HeaderModal(document.getElementById("FAQ"));
}
