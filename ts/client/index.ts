// Core websocket message handlers

import { showAlert } from "../alerts";
import { ImageData, PostData, PostLink } from "../common";
import { connEvent, connSM, handlers, message } from "../connection";
import { FormModel, Post, postEvent, postSM, PostView } from "../posts";
import { page, posts } from "../state";
import { postAdded } from "../ui";
import { OverlayNotification } from "../ui";
import { isAtBottom, scrollToBottom } from "../util";

// Message for splicing the contents of the current line
export interface SpliceResponse {
  id: number;
  start: number;
  len: number;
  text: string;
}

interface CloseMessage {
  id: number;
  links: PostLink[] | null;
}

// Message for inserting images into an open post
interface ImageMessage extends ImageData {
  id: number;
}

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

  const existing = posts.get(data.id);
  if (existing) {
    if (existing instanceof FormModel && !existing.isAllocated) {
      existing.onAllocation(data);
    }
  }

  const model = new Post(data);
  model.op = page.thread;
  model.board = page.board;
  posts.add(model);
  const view = new PostView(model, null);

  if (!model.editing) {
    model.propagateLinks();
  }

  // Find last allocated post and insert after it
  const last = document
    .getElementById("thread-container")
    .firstChild
    .lastElementChild;
  if (last.id === "post0") {
    last.before(view.el);
  } else {
    last.after(view.el);
  }

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

  handlers[message.insertImage] = (msg: ImageMessage) =>
    handle(msg.id, (m) => {
      delete msg.id;
      m.insertImage(msg);
    });

  handlers[message.append] = ([id, char]: [number, number]) =>
    handle(id, (m) =>
      m.append(char));

  handlers[message.backspace] = (id: number) =>
    handle(id, (m) =>
      m.backspace());

  handlers[message.splice] = (msg: SpliceResponse) =>
    handle(msg.id, (m) =>
      m.splice(msg));

  handlers[message.closePost] = ({ id, links }: CloseMessage) =>
    handle(id, (m) => {
      if (links) {
        m.links = links;
        m.propagateLinks();
      }
      m.closePost();
    });

  handlers[message.deletePost] = (id: number) =>
    handle(id, (m) =>
      m.setDeleted());

  handlers[message.deleteImage] = (id: number) =>
    handle(id, (m) =>
      m.removeImage());

  handlers[message.banned] = (id: number) =>
    handle(id, (m) =>
      m.setBanned());

  handlers[message.redirect] = (board: string) => {
    postSM.feed(postEvent.reset);
    location.href = `/${board}/`;
  };

  handlers[message.notification] = (text: string) =>
    new OverlayNotification(text);
}
