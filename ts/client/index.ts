// Core websocket message handlers

import { showAlert } from "../alerts";
import { PostData } from "../common";
import { connEvent, connSM, handlers, message } from "../connection";
import { Post, postEvent, postSM, PostView } from "../posts";
import { page, posts } from "../state";
import { postAdded } from "../ui";
import { isAtBottom, scrollToBottom } from "../util";

// Run a function on a model, if it exists
function handle(id: number, fn: (m: Post) => void) {
  const model = posts.get(id);
  if (model) {
    fn(model);
  }
}

// Insert a post into the models and DOM
export function insertPost(data: PostData) {
  const atBottom = isAtBottom();

  const model = new Post(data);
  model.op = page.thread;
  model.board = page.board;
  posts.add(model);
  const view = new PostView(model, null);

  model.propagateLinks();

  // Find last allocated post and insert after it
  const last = document
    .getElementById("thread-container")
    .firstChild
    .lastElementChild;
  last.after(view.el);

  postAdded(model);

  if (atBottom) {
    scrollToBottom();
  }
}

export function init() {
  handlers[message.invalid] = (msg: string) => {
    showAlert(msg);
    connSM.feed(connEvent.error);
    throw new Error(msg);
  };

  handlers[message.insertPost] = insertPost;

  handlers[message.deletePost] = (id: number) =>
    handle(id, (m) =>
      m.setDeleted());

  handlers[message.redirect] = (board: string) => {
    postSM.feed(postEvent.reset);
    location.href = `/${board}/`;
  };

  // handlers[message.notification] = (text: string) =>
  //   new OverlayNotification(text);

  // handlers[message.insertImage] = (msg: ImageMessage) =>
  //   handle(msg.id, (m) => {
  //     delete msg.id;
  //     m.insertImage(msg);
  //   });

  // handlers[message.append] = ([id, char]: [number, number]) =>
  //   handle(id, (m) =>
  //     m.append(char));

  // handlers[message.backspace] = (id: number) =>
  //   handle(id, (m) =>
  //     m.backspace());

  // handlers[message.splice] = (msg: SpliceResponse) =>
  //   handle(msg.id, (m) =>
  //     m.splice(msg));

  // handlers[message.closePost] = ({ id, links }: CloseMessage) =>
  //   handle(id, (m) => {
  //     if (links) {
  //       m.links = links;
  //       m.propagateLinks();
  //     }
  //     m.closePost();
  //   });

  // handlers[message.deleteImage] = (id: number) =>
  //   handle(id, (m) =>
  //     m.removeImage());

  // handlers[message.banned] = (id: number) =>
  //   handle(id, (m) =>
  //     m.setBanned());
}
