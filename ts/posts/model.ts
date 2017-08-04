import { Model } from "../base";
import { SpliceResponse } from "../client";
import { fileTypes, ImageData, PostData, PostLink } from "../common";
import { mine, page, posts, seenPosts, storeSeenPost } from "../state";
import { notifyAboutReply } from "../ui";
import { extend } from "../util";
import Collection from "./collection";
import { sourcePath } from "./images";
import PostView from "./view";

export interface Backlinks { [id: string]: PostBacklinks; }
export interface PostBacklinks { [id: string]: number; }

// Thread model, mirroring common.Thread.
// Just a stub yet, for usage in isomorphic templates.
export class Thread {
  public id: number;

  constructor(post: Post) {
    this.id = post.op;
  }
}

// Generic post model
// tslint:disable-next-line:max-classes-per-file
export class Post extends Model implements PostData {
  public collection: Collection;
  public view: PostView;

  public op: number;
  public editing: boolean;
  public deleted: boolean;
  public banned: boolean;
  public sticky: boolean;
  public image: ImageData;  // TODO(Kagami): Rename to file
  public time: number;
  public body: string;
  public name: string;
  public trip: string;
  public auth: string;
  public subject: string;
  public board: string;
  public backlinks: PostBacklinks;
  public links: PostLink[];

  public get opPost() {
    return this.id === this.op;
  }

  // TODO(Kagami): Move to ImageData?
  public get transparentThumb() {
    return this.image.thumbType === fileTypes.png;
  }

  public get fileSrc(): string {
    return sourcePath(this.image.fileType, this.image.SHA1);
  }

  constructor(attrs: PostData) {
    super();
    extend(this, attrs);
  }

  // Remove the model from its collection, detach all references and allow to
  // be garbage collected.
  public remove() {
    if (this.collection) {
      this.collection.remove(this);
    }
    if (this.view) {
      this.view.remove();
    }
  }

  // Check if this post replied to one of the user's posts and trigger
  // handlers. Set and render backlinks on any linked posts.
  public propagateLinks() {
    if (this.isReply()) {
      notifyAboutReply(this);
    }
    if (this.links) {
      for (const [id] of this.links) {
        const post = posts.get(id);
        if (post) {
          post.insertBacklink(this.id, this.op);
        }
      }
    }
  }

  // Returns, if post is a reply to one of the user's posts.
  public isReply() {
    if (!this.links) return false;
    for (const [id] of this.links) {
      if (mine.has(id)) {
        return true;
      }
    }
    return false;
  }

  // Insert data about another post linking this post into the model.
  public insertBacklink(id: number, op: number) {
    if (!this.backlinks) {
      this.backlinks = {};
    }
    this.backlinks[id] = op;
    this.view.renderBacklinks();
  }

  // Insert an image into an existing post.
  public insertImage(img: ImageData) {
    this.image = img;
    // this.view.renderImage(false)
  }

  // Set post as banned.
  public setBanned() {
    if (this.banned) return;
    this.banned = true;
    this.view.renderBanned();
  }

  // Set post as deleted.
  public setDeleted() {
    if (this.opPost) {
      if (page.thread) {
        location.href = "/all/";
      } else {
        posts.removeThread(this);
        this.view.removeThread();
      }
    } else {
      posts.remove(this);
      this.view.remove();
    }
  }

  public removeImage() {
    this.image = null;
    // this.view.removeImage()
  }

  // Returns, if this post has been seen already.
  public seen(): boolean {
    // Already seen, nothing to do.
    if (seenPosts.has(this.id)) return true;

    // My posts are always seen.
    if (mine.has(this.id)) return true;

    // Can't see because in inactive tab.
    if (document.hidden) return false;

    // Check if can see on the page.
    const visible = this.view.scrolledPast();
    if (visible) {
      storeSeenPost(this.id, this.op);
      return true;
    }

    // Should be unseen then.
    return false;
  }

  // Append a character to the text body.
  // TODO(Kagami): Remove.
  public append(code: number) {
    /* skip */
  }

  // Backspace one character in the current line.
  // TODO(Kagami): Remove.
  public backspace() {
    /* skip */
  }

  // Splice the current open line of text.
  // TODO(Kagami): Remove.
  public splice(msg: SpliceResponse) {
    /* skip */
  }

  // Close an open post and reparse its last line.
  // TODO(Kagami): Remove.
  public closePost() {
    this.editing = false;
    // this.view.closePost()
  }

  // Extra method for code reuse in post forms.
  // TODO(Kagami): Remove.
  protected spliceText(msg: SpliceResponse) {
    /* skip */
  }
}
