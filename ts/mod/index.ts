// Login/logout/registration facilities for the account system

import { showAlert } from "../alerts";
import API from "../api";
import { ln } from "../lang";
import { Post } from "../posts";
import { getModel, page } from "../state";
import { on } from "../util";
import { TRIGGER_BAN_BY_POST_SEL, TRIGGER_DELETE_POST_SEL } from "../vars";

// Possible staff access levels
export const enum ModerationLevel {
  notLoggedIn = - 1,
  notStaff,
  janitor,
  moderator,
  boardOwner,
  admin,
}

// Current staff position on this page.
export const position: ModerationLevel = (window as any).position;

// Current staff position on any boardl.
export const anyposition: ModerationLevel = (window as any).anyposition;

export function isModerator(): boolean {
  return position >= ModerationLevel.moderator;
}

export function isPowerUser(): boolean {
  return anyposition >= ModerationLevel.janitor;
}

function getModelByEvent(e: Event): Post {
  return getModel(e.target as Element);
}

function deletePost(post: Post, force?: boolean) {
  if (!force && !confirm(ln.UI.delConfirm)) return;
  API.post.delete([post.id]).then(() => {
    // In thread we should delete on WebSocket event.
    if (!page.thread) {
      post.setDeleted();
    }
  }, showAlert);
}

function banUser(post: Post) {
  if (!confirm(ln.UI.banConfirm)) return;
  const YEAR = 365 * 24 * 60;
  API.user.banByPost({
    // Hardcode for now.
    duration: YEAR,
    global: position >= ModerationLevel.admin,
    ids: [post.id],
    reason: "default",
  }).then(() => {
    deletePost(post, true);
  }).catch(showAlert);
}

// Init module.
export function init() {
  if (position < ModerationLevel.moderator) return;

  on(document, "click", (e) => {
    deletePost(getModelByEvent(e));
  }, {selector: TRIGGER_DELETE_POST_SEL});

  on(document, "click", (e) => {
    banUser(getModelByEvent(e));
  }, {selector: TRIGGER_BAN_BY_POST_SEL});
}
