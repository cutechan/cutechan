import { THREAD_SEL } from "../vars"
import { ThreadData } from "../common"
import { page, loadFromDB } from "../state"
import { isBanned, extractPost, extractPageData } from "./common"

function setPostCounter(n: number) {
  const thread = document.querySelector(THREAD_SEL)
  thread.style.counterReset = `p ${n}`
}

// Render the HTML of a thread page.
export async function render() {
  if (isBanned()) {
    return
  }

  await loadFromDB(page.thread)

  const { threads: data, backlinks } = extractPageData<ThreadData>()
  const { posts } = data
  data.posts = null

  // Shift post numbers if opened incomplete thread (+ 1 for OP post).
  if (page.lastN === 100 && data.postCtr > 101) {
    setPostCounter(data.postCtr - 101)
  }

  extractPost(data, data.id, data.board, backlinks)
  for (let post of posts) {
    extractPost(post, data.id, data.board, backlinks)
  }
}
