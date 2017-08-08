import { ThreadData } from "../common";
import { Post } from "../posts";
import { loadPostStores, page, posts } from "../state";
import { on } from "../util";
import { BOARD_SEARCH_INPUT_SEL, BOARD_SEARCH_SORT_SEL } from "../vars";
import { extractPageData, extractPost } from "./common";

type SortFunction = (a: Post, b: Post) => number;

// Thread sort functions
const sorts: { [name: string]: SortFunction } = {
  bump: subtract("bumpTime"),
  creation: subtract("time"),
  fileCount: subtract("imageCtr"),
  replyCount: subtract("postCtr"),
};

// Sort threads by embedded data
function subtract(attr: string): (a: Post, b: Post) => number {
  return (a, b) =>
    b[attr] - a[attr];
}

async function extractCatalogModels() {
  const { threads, backlinks } = extractPageData<ThreadData[]>();
  for (const t of threads) {
    extractPost(t, t.id, t.board, backlinks);
  }
}

async function extractThreads() {
  const { threads, backlinks } = extractPageData<ThreadData[]>();
  await loadPostStores(...threads.map((t) => t.id));
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

// Apply client-side modifications to a board page's HTML.
export async function render() {
  if (page.catalog) {
    await extractCatalogModels();
  } else {
    await extractThreads();
  }

  const container = document.getElementById("threads");
  on(container, "input", onSearchChange, {
    passive: true,
    selector: BOARD_SEARCH_INPUT_SEL,
  });

  if (page.catalog) {
    on(container, "input", onSortChange, {
      passive: true,
      selector: BOARD_SEARCH_SORT_SEL,
    });
    const select = container.querySelector(BOARD_SEARCH_SORT_SEL) as HTMLSelectElement;
    select.value = localStorage.getItem("catalogSort") || "bump";
    sortThreads(true);
  }
}

// Sort all threads on a board
export function sortThreads(initial: boolean) {
  // Index pages are paginated, so it does not make a lot of sense to sort
  // them
  if (!page.catalog) {
    return;
  }

  const [cont, threads] = getThreads();

  const sortMode = localStorage.getItem("catalogSort") || "bump";
  // Already sorted as needed
  if (initial && sortMode === "bump") {
    return;
  }

  // Sort threads by model properties
  const els: { [id: number]: HTMLElement } = {};
  cont.append(...threads
    .map((el) => {
      const id = el.getAttribute("data-id");
      els[id] = el;
      el.remove();
      return posts.get(parseInt(id, 10));
    })
    .sort(sorts[sortMode])
    .map(({ id }) =>
      els[id]),
  );
}

// Retrieves the thread container and the threads within depending on page type
function getThreads(): [HTMLElement, HTMLElement[]] {
  let contID: string;
  let threadSel: string;
  if (page.catalog) {
    contID = "catalog";
    threadSel = ".post";
  } else {
    contID = "index-thread-container";
    threadSel = ".thread";
  }
  const cont = document.getElementById(contID);
  return [
    cont,
    Array.from(cont.querySelectorAll(threadSel)),
  ];
}

// Persist thread sort order mode to localStorage and rerender threads
function onSortChange(e: Event) {
  localStorage.setItem("catalogSort", (e.target as HTMLInputElement).value);
  sortThreads(false);
}

function onSearchChange(e: Event) {
  const filter = (e.target as HTMLInputElement).value;
  filterThreads(filter);
}

// Filter against board and subject and toggle thread visibility
function filterThreads(filter: string) {
  const [ , threads ] = getThreads();
  const r = new RegExp(filter, "i");
  const matched = new Set<number>();
  for (const m of posts) {
    const match = (m.board && r.test(`/${m.board}/`))
      || r.test(m.subject)
      || r.test(m.body);
    if (match) {
      matched.add(m.op);
    }
  }

  for (const el of threads) {
    const id = parseInt(el.getAttribute("data-id"), 10);
    el.style.display = matched.has(id) ? "" : "none";
  }
}
