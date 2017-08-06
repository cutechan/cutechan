import { PostData } from "../common";
import lang from "../lang";
import { Post, PostView } from "../posts";
import { hidden, mine, page, posts } from "../state";
import { notifyAboutReply, postAdded } from "../ui";
import { extractJSON } from "../util";
import { POST_BACKLINKS_SEL } from "../vars";

// Extract pregenerated rendered post data from DOM
export function extractPageData<T>(): {
  threads: T,
  backlinks: { [id: number]: { [id: number]: number } },
} {
  return {
    backlinks: extractJSON("backlink-data"),
    threads: extractJSON("post-data"),
  };
}

// Check if the rendered page is a ban page
export function isBanned(): boolean {
  return !!document.querySelector(".ban");
}

// Extract post model and view from the HTML fragment and apply client-specific
// formatting. Returns whether the element was removed.
export function extractPost(
  post: PostData,
  op: number,
  board: string,
  backlinks: { [id: number]: { [id: number]: number } },
): boolean {
  const el = document.getElementById(`post${post.id}`);
  if (hidden.has(post.id)) {
    el.remove();
    return true;
  }
  post.op = op;
  post.board = board;

  const model = new Post(post);
  const view = new PostView(model, el);
  view.afterRender();
  posts.add(model);

  if (page.catalog) {
    return false;
  }

  model.backlinks = backlinks[post.id];

  personalizeLinks(model);
  personalizeBacklinks(model);
  postAdded(model);

  return false;
}

function addYous(id: number, el: HTMLElement) {
  for (const a of el.querySelectorAll(`a[data-id="${id}"]`)) {
    a.textContent += ` ${lang.posts.you}`;
  }
}

// Add (You) to posts linking to the user's posts. Appends to array of posts,
// that might need to register a new reply to one of the user's posts.
function personalizeLinks(post: Post) {
  if (!post.links) {
    return;
  }
  let el: HTMLElement;
  let isReply = false;
  for (const id of new Set(post.links.map((l) => l[0]))) {
    if (!mine.has(id)) {
      continue;
    }
    isReply = true;

    // Don't query DOM, until we know we need it
    if (!el) {
      el = post.view.el.querySelector("blockquote");
    }
    addYous(id, el);
  }
  if (isReply) {
    notifyAboutReply(post);
  }
}

// Add (You) to backlinks user's posts
function personalizeBacklinks(post: Post) {
  if (!post.backlinks) {
    return;
  }
  let el: HTMLElement;
  for (const idStr of Object.keys(post.backlinks)) {
    const id = parseInt(idStr, 10);
    if (!mine.has(id)) {
      continue;
    }
    // Don't query DOM, until we know we need it
    if (!el) {
      el = post.view.el.querySelector(POST_BACKLINKS_SEL);
    }
    addYous(id, el);
  }
}
