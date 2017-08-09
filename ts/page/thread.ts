import { ThreadData } from "../common";
import { extractPageData, extractPost, isBanned } from "./common";

// Render the HTML of a thread page.
export function render() {
  if (isBanned()) return;

  const { threads: data, backlinks } = extractPageData<ThreadData>();
  const { posts } = data;
  data.posts = null;

  extractPost(data, data.id, data.board, backlinks);
  for (const post of posts) {
    extractPost(post, data.id, data.board, backlinks);
  }
}
