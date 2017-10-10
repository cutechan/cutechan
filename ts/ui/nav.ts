/**
 * Handle page navigation.
 */

import { on, scrollToBottom, scrollToTop } from "../util";
import {
  PAGE_NAV_BOTTOM_SEL, PAGE_NAV_TOP_SEL,
  TRIGGER_PAGE_NAV_BOTTOM_SEL, TRIGGER_PAGE_NAV_TOP_SEL,
} from "../vars";

let topBtn = null as HTMLElement;
let bottomBtn = null as HTMLElement;

function onScroll() {
  const el = document.documentElement;
  const needTop = el.scrollTop > 300;
  const needBottom = el.scrollHeight - el.scrollTop  > el.clientHeight + 300;
  topBtn.style.display = needTop ? "" : "none";
  bottomBtn.style.display = needBottom ? "" : "none";
  topBtn.classList.toggle("page-nav-item_active", needTop);
  bottomBtn.classList.toggle("page-nav-item_active", needBottom);
}

export function init() {
  topBtn = document.querySelector(PAGE_NAV_TOP_SEL);
  bottomBtn = document.querySelector(PAGE_NAV_BOTTOM_SEL);
  if (!topBtn || !bottomBtn) return;

  document.addEventListener("scroll", onScroll, {passive: true});
  on(document, "click", scrollToTop, {selector: TRIGGER_PAGE_NAV_TOP_SEL});
  on(document, "click", scrollToBottom, {selector: TRIGGER_PAGE_NAV_BOTTOM_SEL});
  onScroll();
}
