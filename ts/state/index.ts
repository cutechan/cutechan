// Stores the central state of the web application

import { Post, PostCollection } from '../posts'
import { getClosestID } from '../util'
import { readIDs, storeID } from '../db'
import { send } from '../connection'

// Server-wide global configurations
interface Config {
  captcha: boolean
  disableUserBoards: boolean
  maxSize: number
  pruneThreads: boolean
  threadExpiryMin: number
  threadExpiryMax: number
  defaultLang: string
  defaultCSS: string
  imageRootOverride: string
}

// BoardTitle contains a board's ID and title
export interface BoardTitle {
  id: string
  title: string
}

// Board-specific configurations
export interface BoardConfig {
  title: string
  readOnly: boolean
}

// The current state of a board or thread page
export type PageState = {
  landing: boolean,
  catalog: boolean
  thread: number
  lastN: number
  page: number
  board: string
  href: string
}

const YEAR = 365 * 24 * 60 * 60 * 1000

// Configuration passed from the server. Some values can be changed during
// runtime.
export const config: Config = (window as any).config

// Currently existing boards
export let boards: [BoardTitle] = (window as any).boards

export let boardConfig: BoardConfig = null

// Load initial page state
export const page = read(location.href)

// All posts currently displayed
export const posts = new PostCollection()

// Posts I made in any tab
export let mine: Set<number>

// Posts that the user has already seen or scrolled past
export let seenPosts: Set<number>

// Replies to this user's posts the user has already seen
export let seenReplies: Set<number>

// Explicitly hidden posts and threads
export let hidden: Set<number>

// Debug mode with more verbose logging
export let debug: boolean = /[\?&]debug=true/.test(location.href)

// Read page state by parsing a URL
// TODO(Kagami): Pass this from server-side.
export function read(href: string): PageState {
  const u = document.createElement("a")
  u.href = href
  const thread = u.pathname.match(/^\/\w+\/(\d+)/)
  const page = u.search.match(/[&\?]page=(\d+)/)
  return {
    href,
    landing: u.pathname === "/",
    board: u.pathname.match(/^\/(\w+)?\/?/)[1],
    lastN: /[&\?]last=100/.test(u.search) ? 100 : 0,
    page: page ? parseInt(page[1]) : 0,
    catalog: /^\/\w+\/catalog/.test(u.pathname),
    thread: parseInt(thread && thread[1]) || 0,
  } as PageState
}

// Load post number sets for specific threads from the database
export function loadFromDB(...threads: number[]): Promise<Set<number>[]> {
  return Promise.all([
    readIDs("mine", ...threads).then(ids =>
      mine = new Set(ids)),
    readIDs("seen", ...threads).then(ids =>
      seenReplies = new Set(ids)),
    readIDs("seenPost", ...threads).then(ids =>
      seenPosts = new Set(ids)),
    readIDs("hidden", ...threads).then((ids) =>
      hidden = new Set(ids)),
  ])
}

// Store the ID of a post this client created
export function storeMine(id: number, op: number) {
  store(mine, "mine", id, op)
}

// Store the ID of a post that replied to one of the user's posts
export function storeSeenReply(id: number, op: number) {
  store(seenReplies, "seen", id, op)
}

export function storeSeenPost(id: number, op: number) {
  store(seenPosts, "seenPost", id, op)
}

// Store the ID of a post or thread to hide
export function storeHidden(id: number, op: number) {
  store(hidden, "hidden", id, op)
}

function store(set: Set<number>, key: string, id: number, op: number) {
  set.add(id)
  storeID(key, id, op, YEAR)
}

export function setBoardConfig(c: BoardConfig) {
  boardConfig = c
}

// Retrieve model of closest parent post
export function getModel(el: Element): Post {
  const id = getClosestID(el)
  if (!id) {
    return null
  }
  return PostCollection.getFromAll(id)
}

// Display or hide the loading animation
export function displayLoading(display: boolean) {
}

; (window as any).debugMode = () => {
  debug = true;
  (window as any).send = send
}
