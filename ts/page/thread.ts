import { ThreadData } from "../common";
import { loadFromDB, page } from "../state";
import { extractPageData, extractPost, isBanned } from "./common";

// Render the HTML of a thread page.
export async function render() {
  if (isBanned()) return;

  await loadFromDB(page.thread);

  const { threads: data, backlinks } = extractPageData<ThreadData>();
  const { posts } = data;
  data.posts = null;

  extractPost(data, data.id, data.board, backlinks);
  for (const post of posts) {
    extractPost(post, data.id, data.board, backlinks);
  }
}
