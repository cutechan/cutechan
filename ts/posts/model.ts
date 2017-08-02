import { Model } from '../base'
import { extend } from '../util'
import Collection from './collection'
import PostView from './view'
import { sourcePath } from "./images"
import { SpliceResponse } from '../client'
import { mine, seenPosts, storeSeenPost, posts, page } from "../state"
import { notifyAboutReply } from "../ui"
import { PostData, PostLink, ImageData, fileTypes } from "../common"

export type Backlinks = { [id: string]: PostBacklinks }
export type PostBacklinks = { [id: string]: number }

// Thread model, mirroring common.Thread.
// Just a stub yet, for usage in isomorphic templates.
export class Thread {
  public id: number

  constructor(post: Post) {
    this.id = post.op
  }
}

// Generic post model
export class Post extends Model implements PostData {
  public collection: Collection
  public view: PostView

  public op: number
  public editing: boolean
  public deleted: boolean
  public banned: boolean
  public sticky: boolean
  protected seenOnce: boolean
  public image: ImageData  // TODO(Kagami): Rename to file
  public time: number
  public body: string
  public name: string
  public trip: string
  public auth: string
  public subject: string
  public board: string
  public backlinks: PostBacklinks
  public links: PostLink[]

  public get opPost() {
    return this.id == this.op
  }

  public get transparentThumb() {
    return this.image && this.image.thumbType === fileTypes.png
  }

  // TODO(Kagami): Move to ImageData?
  public get fileSrc(): string {
    return sourcePath(this.image.fileType, this.image.SHA1)
  }

  constructor(attrs: PostData) {
    super()
    extend(this, attrs)
    this.seenOnce = seenPosts.has(this.id)
  }

  // Remove the model from its collection, detach all references and allow to
  // be garbage collected.
  public remove() {
    if (this.collection) {
      this.collection.remove(this)
    }
    if (this.view) {
      this.view.remove()
    }
  }

  // Check if this post replied to one of the user's posts and trigger
  // handlers. Set and render backlinks on any linked posts.
  public propagateLinks() {
    if (this.isReply()) {
      notifyAboutReply(this)
    }
    if (this.links) {
      for (let [id] of this.links) {
        const post = posts.get(id)
        if (post) {
          post.insertBacklink(this.id, this.op)
        }
      }
    }
  }

  // Returns, if post is a reply to one of the user's posts.
  public isReply() {
    if (!this.links) return false
    for (let [id] of this.links) {
      if (mine.has(id)) {
        return true
      }
    }
    return false
  }

  // Insert data about another post linking this post into the model.
  public insertBacklink(id: number, op: number) {
    if (!this.backlinks) {
      this.backlinks = {}
    }
    this.backlinks[id] = op
    this.view.renderBacklinks()
  }

  // Insert an image into an existing post.
  public insertImage(img: ImageData) {
    this.image = img
    // this.view.renderImage(false)
  }

  // Set post as banned.
  public setBanned() {
    if (this.banned) return
    this.banned = true
    this.view.renderBanned()
  }

  // Set post as deleted.
  public setDeleted() {
    if (this.opPost) {
      if (page.thread) {
        location.href = "/all/"
      } else {
        posts.removeThread(this)
        this.view.removeThread()
      }
    } else {
      posts.remove(this)
      this.view.remove()
    }
  }

  public removeImage() {
    this.image = null
    // this.view.removeImage()
  }

  // Returns, if this post has been seen already.
  public seen() {
    if (this.seenOnce) return true

    this.seenOnce = seenPosts.has(this.id)
    if (this.seenOnce) return true

    if (document.hidden) return false

    this.seenOnce = this.view.scrolledPast()
    if (this.seenOnce) {
      storeSeenPost(this.id, this.op)
      return true
    }

    return false
  }

  // Append a character to the text body.
  // TODO(Kagami): Remove.
  public append(code: number) {
  }

  // Backspace one character in the current line.
  // TODO(Kagami): Remove.
  public backspace() {
  }

  // Splice the current open line of text.
  // TODO(Kagami): Remove.
  public splice(msg: SpliceResponse) {
  }

  // Extra method for code reuse in post forms.
  // TODO(Kagami): Remove.
  protected spliceText(msg: SpliceResponse) {
  }

  // Close an open post and reparse its last line.
  // TODO(Kagami): Remove.
  public closePost() {
    this.editing = false
    // this.view.closePost()
  }
}
