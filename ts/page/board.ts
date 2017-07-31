import { on } from '../util'
import { page, posts, loadFromDB } from '../state'
import { Post } from "../posts"
import { extractPost, extractPageData } from "./common"
import { ThreadData } from "../common"
import { BOARD_SEARCH_INPUT_SEL, BOARD_SORT_SEL } from "../vars"

type SortFunction = (a: Post, b: Post) => number

// Thread sort functions
const sorts: { [name: string]: SortFunction } = {
  bump: subtract("bumpTime"),
  creation: subtract("time"),
  replyCount: subtract("postCtr"),
  fileCount: subtract("imageCtr"),
}

// Sort threads by embedded data
function subtract(attr: string): (a: Post, b: Post) => number {
  return (a, b) =>
    b[attr] - a[attr]
}

async function extractCatalogModels() {
  const { threads, backlinks } = extractPageData<ThreadData[]>()
  await loadIDStores(threads)
  for (let t of threads) {
    extractPost(t, t.id, t.board, backlinks)
  }
}

async function loadIDStores(threads: ThreadData[]) {
  await loadFromDB(...(threads as ThreadData[]).map(t => t.id))
}

async function extractThreads() {
  const { threads, backlinks } = extractPageData<ThreadData[]>()
  await loadIDStores(threads)
  for (let thread of threads) {
    const { posts } = thread
    delete thread.posts
    if (extractPost(thread, thread.id, thread.board, backlinks)) {
      document.querySelector(`section[data-id="${thread.id}"]`).remove()
      continue
    }
    for (let post of posts) {
      extractPost(post, thread.id, thread.board, backlinks)
    }
  }
}

// Apply client-side modifications to a board page's HTML.
export async function render() {
  if (page.catalog) {
    await extractCatalogModels()
  } else {
    await extractThreads()
  }

  const container = document.getElementById("threads")
  on(container, "input", onSearchChange, {
    passive: true,
    selector: BOARD_SEARCH_INPUT_SEL,
  })

  if (page.catalog) {
    on(container, "input", onSortChange, {
      passive: true,
      selector: BOARD_SORT_SEL,
    })
    const select = container.querySelector(BOARD_SORT_SEL) as HTMLSelectElement
    select.value = localStorage.getItem("catalogSort") || "bump"
    sortThreads(true)
  }
}

// Sort all threads on a board
export function sortThreads(initial: boolean) {
  // Index pages are paginated, so it does not make a lot of sense to sort
  // them
  if (!page.catalog) {
    return
  }

  const [cont, threads] = getThreads()

  const sortMode = localStorage.getItem("catalogSort") || "bump"
  // Already sorted as needed
  if (initial && sortMode === "bump") {
    return
  }

  // Sort threads by model properties
  const els: { [id: number]: HTMLElement } = {}
  cont.append(...threads
    .map(el => {
      const id = el.getAttribute("data-id")
      els[id] = el
      el.remove()
      return posts.get(parseInt(id))
    })
    .sort(sorts[sortMode])
    .map(({ id }) =>
      els[id])
  )
}

// Retrieves the thread container and the threads within depending on page type
function getThreads(): [HTMLElement, HTMLElement[]] {
  let contID: string,
    threadSel: string
  if (page.catalog) {
    contID = "catalog"
    threadSel = ".post"
  } else {
    contID = "index-thread-container"
    threadSel = ".thread"
  }
  const cont = document.getElementById(contID)
  return [
    cont,
    Array.from(cont.querySelectorAll(threadSel)),
  ]
}

// Persist thread sort order mode to localStorage and rerender threads
function onSortChange(e: Event) {
  localStorage.setItem("catalogSort", (e.target as HTMLInputElement).value)
  sortThreads(false)
}

function onSearchChange(e: Event) {
  const filter = (e.target as HTMLInputElement).value
  filterThreads(filter)
}

// Filter against board and subject and toggle thread visibility
function filterThreads(filter: string) {
  const [, threads] = getThreads(),
    r = new RegExp(filter, "i"),
    matched = new Set<number>()
  for (let m of posts) {
    const match = (m.board && r.test(`/${m.board}/`))
      || r.test(m.subject)
      || r.test(m.body)
    if (match) {
      matched.add(m.op)
    }
  }

  for (let el of threads) {
    const id = parseInt(el.getAttribute("data-id"))
    el.style.display = matched.has(id) ? "" : "none"
  }
}
