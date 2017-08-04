// Hide posts you don't like

import { clearStore } from "../db";
import { hidden, storeHidden } from "../state";
import { trigger } from "../util";
import { Post } from "./model";

// Hide a post and persist to database
export function hidePost(model: Post) {
  model.remove();
  storeHidden(model.id, model.op);
  trigger("renderHiddenCount", hidden.size);
}

// Clear all hidden posts
export function clearHidden() {
  hidden.clear();
  trigger("renderHiddenCount", 0);
  clearStore("hidden");
}
