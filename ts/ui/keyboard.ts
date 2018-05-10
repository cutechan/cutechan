/**
 * Keyboard shortcuts handling.
 */

import options from "../options";
import { page } from "../state";
import { HOOKS, trigger } from "../util";

// Navigate one level up the board tree, if possible.
function navigateUp() {
  if (page.thread) {
    location.href = `/${page.board}/`;
  } else if (page.board !== "all") {
    location.href = "/all/";
  } else {
    location.href = "/";
  }
}

function handleShortcut(e: KeyboardEvent) {
  let caught = false;
  if (e.altKey) {
    switch (e.which) {
    case options.newPost:
      caught = true;
      trigger(HOOKS.openReply);
      break;
    case options.cancelPost:
      caught = true;
      trigger(HOOKS.closeReply);
      break;
    case options.selectFile:
      caught = true;
      trigger(HOOKS.selectFile);
      break;
    case options.previewPost:
      caught = true;
      trigger(HOOKS.previewPost);
      break;
    case options.bold:
      caught = true;
      trigger(HOOKS.boldMarkup);
      break;
    case options.italic:
      caught = true;
      trigger(HOOKS.italicMarkup);
      break;
    case options.spoiler:
      caught = true;
      trigger(HOOKS.spoilerMarkup);
      break;
    case options.idolSearch:
      caught = true;
      trigger(HOOKS.focusIdolSearch);
      break;
    case options.workMode:
      caught = true;
      options.workModeToggle = !options.workModeToggle;
      break;
    case 38:
      caught = true;
      navigateUp();
      break;
    }
  } else if (e.ctrlKey) {
    switch (e.key) {
    case "Enter":
      caught = true;
      trigger(HOOKS.sendReply);
      break;
    }
  }
  if (caught) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}

// Bind keyboard event listener to the document.
export function init() {
  document.addEventListener("keydown", handleShortcut);
}
