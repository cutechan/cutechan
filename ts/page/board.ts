import { ThreadData } from "../common";
import { Post } from "../posts";
import { page, posts } from "../state";
import { getID, on } from "../util";
import { BOARD_SEARCH_INPUT_SEL, BOARD_SEARCH_SORT_SEL } from "../vars";
import { extractPageData, extractPost } from "./common";

type SortFunction = (a: Post, b: Post) => number;

// Sort threads by embedded data.
function subtract(attr: string): (a: Post, b: Post) => number {
  return (a, b) => b[attr] - a[attr];
}

// Thread sort functions.
const sorts: { [name: string]: SortFunction } = {
  bump: subtract("bumpTime"),
  creation: subtract("time"),
  fileCount: subtract("imageCtr"),
  replyCount: subtract("postCtr"),
};

function extractCatalogModels() {
  const { threads, backlinks } = extractPageData<ThreadData[]>();
  for (const t of threads) {
    extractPost(t, t.id, t.board, backlinks);
  }
}

function extractThreads() {
  const { threads, backlinks } = extractPageData<ThreadData[]>();
  for (const thread of threads) {
    const { posts: threadPosts } = thread;
    delete thread.posts;
    if (extractPost(thread, thread.id, thread.board, backlinks)) {
      document.getElementById(`thread${thread.id}`).remove();
      continue;
    }
    for (const post of threadPosts) {
      extractPost(post, thread.id, thread.board, backlinks);
    }
  }
}

// Retrieves the thread container and the threads within depending on
// page type.
function getThreads(): [HTMLElement, HTMLElement[]] {
  let contID = "";
  let threadSel = "";
  if (page.catalog) {
    contID = "catalog";
    threadSel = ".post-catalog-wrapper";
  } else {
    contID = "index-thread-container";
    threadSel = ".thread";
  }
  const container = document.getElementById(contID);
  const threads: NodeListOf<HTMLElement> = container.querySelectorAll(threadSel);
  return [container, Array.from(threads)];
}

function onSearchChange(e: Event) {
  const filter = (e.target as HTMLInputElement).value;
  filterThreads(filter);
}

// Persist thread sort order mode to localStorage and rerender threads.
function onSortChange(e: Event) {
  localStorage.setItem("catalogSort", (e.target as HTMLInputElement).value);
  sortThreads(false);
}

// Filter against board and subject and toggle thread visibility.
function filterThreads(filter: string) {
  const [ , threads ] = getThreads();
  const r = new RegExp(filter, "i");
  const matched = new Set<number>();

  for (const p of posts) {
    const match = (p.board && r.test(`/${p.board}/`))
      || r.test(p.subject)
      || r.test(p.body);
    if (match) {
      matched.add(p.op);
    }
  }

  for (const el of threads) {
    const id = getID(el);
    el.style.display = matched.has(id) ? "" : "none";
  }
}

// Sort all threads on a board.
function sortThreads(initial: boolean) {
  // Index pages are paginated, so it does not make a lot of sense to
  // sort them.
  if (!page.catalog) return;

  const [container, threads] = getThreads();

  const sortMode = localStorage.getItem("catalogSort") || "bump";
  // Already sorted as needed.
  if (initial && sortMode === "bump") return;

  // Sort threads by model properties.
  const els: { [id: number]: HTMLElement } = {};
  const sortedThreads = threads
    .map((el) => {
      const id = getID(el);
      els[id] = el;
      return posts.get(id);
    })
    .sort(sorts[sortMode])
    .map(({ id }, i) => {
      const el = els[id];
      el.style.zIndex = (-i).toString();
      el.remove();
      return el;
    });
  container.append(...sortedThreads);
}

// Apply client-side modifications to a board page's HTML.
export function render() {
  if (page.catalog) {
    extractCatalogModels();
  } else {
    extractThreads();
  }

  if (page.catalog) {
    const container = document.getElementById("threads");
    on(container, "input", onSearchChange, {selector: BOARD_SEARCH_INPUT_SEL});
    on(container, "input", onSortChange, {selector: BOARD_SEARCH_SORT_SEL});
    const select = container.querySelector(BOARD_SEARCH_SORT_SEL) as HTMLSelectElement;
    select.value = localStorage.getItem("catalogSort") || "bump";
    sortThreads(true);
  }
}
