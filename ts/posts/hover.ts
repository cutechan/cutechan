/**
 * Post and image hover previews.
 */

import API from "../api";
import { View } from "../base";
import options from "../options";
import { getModel, page, posts } from "../state";
import {
  ChangeEmitter, emitChanges,
  getClosestID, getID, hook, HOOKS,
} from "../util";
import {
  HOVER_CONTAINER_SEL, HOVER_TRIGGER_TIMEOUT_SECS,
  POST_EMBED_SEL, POST_FILE_THUMB_SEL,
  POST_HOVER_TIMEOUT_SECS, POST_LINK_SEL,
} from "../vars";
import { Post } from "./model";
import * as popup from "./popup";
import PostView from "./view";

interface MouseMove extends ChangeEmitter {
  event: MouseEvent;
}

// Centralized mousemove target tracking.
const mouseMove = emitChanges<MouseMove>({
  event: {
    target: null,
  },
} as MouseMove);

let container = null as HTMLElement;
let lastTarget = null as EventTarget;
let delayedTID = 0;
let clearPostTID = 0;
const postPreviews = [] as [PostPreview];
let imagePreview = null as HTMLImageElement;

// Clone a post element as a preview.
// TODO(Kagami): Render mustache template instead?
function clonePost(el: HTMLElement): HTMLElement {
  const preview = el.cloneNode(true) as HTMLElement;
  preview.removeAttribute("id");
  preview.classList.add("post_hover");
  return preview;
}

// Post hover preview view.
class PostPreview extends View<Post> {
  public el: HTMLElement;
  public parent: HTMLElement;

  constructor(model: Post, parent: HTMLElement) {
    const { el } = model.view;
    super({el: clonePost(el)});
    this.parent = parent;
    this.model = Object.assign({}, model);
    this.render();
    parent.addEventListener("click", clearPostPreviews);
  }

  // Remove this view.
  public remove() {
    this.parent.removeEventListener("click", clearPostPreviews);
    super.remove();
  }

  private render() {
    // Underline reverse post links in preview.
    const re = new RegExp("[>\/]" + getClosestID(this.parent));
    for (const el of this.el.querySelectorAll(POST_LINK_SEL)) {
      if (re.test(el.textContent)) {
        el.classList.add("post-link_ref");
      }
    }
    container.append(this.el);
    this.position();
  }

  // Position the preview element relative to it's parent link.
  private position() {
    const height = this.el.offsetHeight;
    const rect = this.parent.getBoundingClientRect();
    const left = rect.left + window.pageXOffset;
    let top = rect.top + window.pageYOffset;

    // The preview will never take up more than 100% screen width, so no
    // need for checking horizontal overflow. Must be applied before
    // reading the height, so it takes into account post resizing to
    // viewport edge.
    this.el.style.left = left + "px";

    top -= height;
    // If post gets cut off at the top, put it bellow the link.
    if (top < window.pageYOffset) {
      top += height + 20;
    }
    this.el.style.top = top + "px";
  }
}

async function renderPostPreview(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.matches || !target.matches(POST_LINK_SEL)) {
    if (postPreviews.length && !clearPostTID) {
      clearPostTID = window.setTimeout(
        clearInactivePostPreviews,
        POST_HOVER_TIMEOUT_SECS * 1000,
      );
    }
    return;
  }

  const id = getID(target);
  if (!id) return;
  // Don't duplicate.
  const len = postPreviews.length;
  if (len && postPreviews[len - 1].model.id === id) return;

  let post = posts.get(id);
  if (!post) {
    // Fetch from server, if this post is not currently displayed due to
    // lastN or in a different thread.
    const data = await API.post.get(id);
    post = new Post(data);
    const view = new PostView(post, null);
    await view.afterRender();
    post.seenOnce = true;
    posts.add(post);
  }

  const preview = new PostPreview(post, target);
  postPreviews.push(preview);
}

function showImage(url: string, width: number, height: number) {
  if (popup.isOpen(url)) return;
  const rect = popup.getCenteredRect({width, height});
  imagePreview = document.createElement("img");
  imagePreview.className = "media_hover";
  imagePreview.src = url;
  imagePreview.style.left = rect.left + "px";
  imagePreview.style.top = rect.top + "px";
  imagePreview.width = rect.width;
  container.append(imagePreview);
}

function renderPostImagePreview(thumb: HTMLImageElement): any {
  const post = getModel(thumb);
  const file = post.getFileByThumb(thumb.src);
  if (file.video) return;
  const [width, height] = file.dims;
  showImage(file.src, width, height);
}

function renderPostEmbedPreview(link: HTMLElement): any {
  const url = link.dataset.thumbnail_url;
  if (!url) return;
  const width = +link.dataset.thumbnail_width;
  const height = +link.dataset.thumbnail_height;
  showImage(url, width, height);
}

function renderImagePreview(event: MouseEvent) {
  clearImagePreview();
  if (!options.imageHover) return;

  const target = event.target as HTMLElement;
  if (!target.matches) return;

  if (target.matches(POST_FILE_THUMB_SEL)) {
    renderPostImagePreview(target as HTMLImageElement);
  } else if (target.matches(POST_EMBED_SEL)) {
    renderPostEmbedPreview(target);
  }
}

function clearInactivePostPreviews() {
  clearPostTID = 0;
  const target = mouseMove.event.target as HTMLElement;
  for (let i = postPreviews.length - 1; i >= 0; i--) {
    const preview = postPreviews[i];
    if (target === preview.parent || preview.el.contains(target)) return;
    postPreviews.pop().remove();
  }
}

function clearPostPreviews() {
  while (postPreviews.length) {
    postPreviews.pop().remove();
  }
}

function clearImagePreview() {
  if (imagePreview) {
    imagePreview.remove();
    imagePreview = null;
  }
}

function delayedSetEvent(event: MouseEvent) {
  if (event.target !== mouseMove.event.target) {
    mouseMove.event = event;
  }
}

function onMouseMove(event: MouseEvent) {
  if (event.target !== lastTarget) {
    lastTarget = event.target;
    clearTimeout(delayedTID);
    // Don't show previews when moving mouse across the page.
    delayedTID = window.setTimeout(() =>
      delayedSetEvent(event),
      HOVER_TRIGGER_TIMEOUT_SECS * 1000,
    );
  }
}

export function isOpen(): boolean {
  return !!imagePreview || !!postPreviews.length;
}

export function init() {
  container = document.querySelector(HOVER_CONTAINER_SEL);
  container.classList.add(page.thread ? "hover-container_thread" : "hover-container_board");
  document.addEventListener("mouseover", onMouseMove);
  mouseMove.onChange("event", renderPostPreview);
  mouseMove.onChange("event", renderImagePreview);
  hook(HOOKS.openPostPopup, clearImagePreview);
}
