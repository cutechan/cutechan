// Stores the central state of the web application

import { readIDs, storeID } from "../db";
import { Post, PostCollection } from "../posts";
import { getClosestID } from "../util";
import { POST_IDS_EXPIRY_MS } from "../vars";

// Server-wide global configurations
interface Config {
  captcha: boolean;
  disableUserBoards: boolean;
  maxSize: number;
  pruneThreads: boolean;
  threadExpiryMin: number;
  threadExpiryMax: number;
  defaultLang: string;
  defaultCSS: string;
  imageRootOverride: string;
}

// Board-specific configurations
export interface BoardConfig {
  id: string;
  title: string;
}

// The current state of a board or thread page
export interface PageState {
  landing: boolean;
  catalog: boolean;
  thread: number;
  lastN: number;
  page: number;
  board: string;
  href: string;
}

// Configuration passed from the server. Some values can be changed during
// runtime.
export const config: Config = (window as any).config;

// Currently existing boards
export let boards: BoardConfig[] = (window as any).boards;

// Load initial page state
export const page = read(location.href);

// All posts currently displayed
export const posts = new PostCollection();

// Posts I made in any tab
export let mine: Set<number>;

// Posts that the user has already seen or scrolled past
export let seenPosts: Set<number>;

// Replies to this user's posts the user has already seen
export let seenReplies: Set<number>;

// Explicitly hidden posts and threads
export let hidden: Set<number>;

// Read page state by parsing a URL
// TODO(Kagami): Pass this from server-side.
export function read(href: string): PageState {
  const u = document.createElement("a");
  u.href = href;

  // WTF, IE?
  // https://stackoverflow.com/a/956376
  let pathname = u.pathname;
  if (!pathname.startsWith("/")) {
    pathname = "/" + pathname;
  }

  const thread = pathname.match(/^\/\w+\/(\d+)/);
  const pageN = u.search.match(/[&\?]page=(\d+)/);

  return {
    board: pathname.match(/^\/(\w+)?\/?/)[1],
    catalog: /^\/\w+\/catalog/.test(pathname),
    href,
    landing: pathname === "/",
    lastN: /[&\?]last=100/.test(u.search) ? 100 : 0,
    page: pageN ? parseInt(pageN[1], 10) : 0,
    thread: parseInt(thread && thread[1], 10) || 0,
  };
}

// Load post number sets for specific threads from the database
export function loadFromDB(...threads: number[]): Promise<Array<Set<number>>> {
  return Promise.all([
    readIDs("mine", ...threads).then((ids) =>
      mine = new Set(ids)),
    readIDs("seen", ...threads).then((ids) =>
      seenReplies = new Set(ids)),
    readIDs("seenPost", ...threads).then((ids) =>
      seenPosts = new Set(ids)),
    readIDs("hidden", ...threads).then((ids) =>
      hidden = new Set(ids)),
  ]);
}

// Store the ID of a post this client created
export function storeMine(id: number, op: number) {
  store(mine, "mine", id, op);
}

// Store the ID of a post that replied to one of the user's posts
export function storeSeenReply(id: number, op: number) {
  store(seenReplies, "seen", id, op);
}

export function storeSeenPost(id: number, op: number) {
  store(seenPosts, "seenPost", id, op);
}

// Store the ID of a post or thread to hide
export function storeHidden(id: number, op: number) {
  store(hidden, "hidden", id, op);
}

function store(set: Set<number>, key: string, id: number, op: number) {
  set.add(id);
  storeID(key, id, op, POST_IDS_EXPIRY_MS);
}

// Retrieve model of closest parent post
export function getModel(el: Element): Post {
  const id = getClosestID(el);
  if (!id) {
    return null;
  }
  return posts.get(id);
}
