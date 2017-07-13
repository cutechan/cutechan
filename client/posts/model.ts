import { Model } from '../base'
import { extend } from '../util'
import Collection from './collection'
import PostView from './view'
import { SpliceResponse } from '../client'
import { mine, seenPosts, storeSeenPost, posts, page } from "../state"
import { notifyAboutReply } from "../ui"
import { PostData, TextState, PostLink, Command, ImageData, fileTypes } from "../common"

export type Backlinks = { [id: number]: PostBacklinks }
export type PostBacklinks = { [id: number]: number }

// Thread model, mirroring common.Thread.
// Just a stub yet, for usage in isomorphic templates.
export class Thread {
	public id: number

	constructor() {
		this.id = page.thread
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
	public state: TextState
	public commands: Command[]
	public backlinks: PostBacklinks
	public links: PostLink[]

	public get opPost() {
		return this.id == this.op
	}

	public get transparentThumb() {
		return this.image && this.image.thumbType === fileTypes.png
	}

	constructor(attrs: PostData) {
		super()
		extend(this, attrs)
		this.seenOnce = seenPosts.has(this.id)

		// All kinds of interesting races can happen, so best ensure a model
		// always has the state object defined
		this.state = {
			spoiler: false,
			quote: false,
			lastLineEmpty: false,
			code: false,
			haveSyncwatch: false,
			iDice: 0,
		}
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

	// Append a character to the text body
	public append(code: number) {
		const char = String.fromCodePoint(code)
		this.body += char

		// It is possible to receive text body updates after a post closes,
		// due to server-side buffering optimizations. If so, rerender the body.
		const needReparse = char === "\n"
			|| !this.editing
			|| this.state.code
			|| endsWithTag(this.body)
		if (needReparse) {
			this.view.reparseBody()
		} else {
			// this.view.appendString(char)
		}
	}

	// Backspace one character in the current line
	public backspace() {
		const needReparse = this.body[this.body.length - 1] === "\n"
			|| !this.editing
			|| this.state.code
			|| endsWithTag(this.body)
		this.body = this.body.slice(0, -1)
		if (needReparse) {
			this.view.reparseBody()
		} else {
			// this.view.backspace()
		}
	}

	// Splice the current open line of text
	public splice(msg: SpliceResponse) {
		this.spliceText(msg)
		this.view.reparseBody()
	}

	// Extra method for code reuse in post forms
	protected spliceText({ start, len, text }: SpliceResponse) {
		// Must use arrays of chars to properly splice multibyte unicode
		const arr = [...this.body]
		arr.splice(start, len, ...text)
		this.body = arr.join("")
	}

	// Check if this post replied to one of the user's posts and trigger
	// handlers.
	// Set and render backlinks on any linked posts.
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

	// Returns, if post is a reply to one of the user's posts
	public isReply() {
		if (!this.links) {
			return false
		}
		for (let [id] of this.links) {
			if (mine.has(id)) {
				return true
			}
		}
		return false
	}

	// Insert data about another post linking this post into the model
	public insertBacklink(id: number, op: number) {
		if (!this.backlinks) {
			this.backlinks = {}
		}
		this.backlinks[id] = op
		this.view.renderBacklinks()
	}

	// Insert an image into an existing post
	public insertImage(img: ImageData) {
		this.image = img
		// this.view.renderImage(false)
	}

	// Close an open post and reparse its last line
	public closePost() {
		this.editing = false
		// this.view.closePost()
	}

	// Set post as banned
	public setBanned() {
		if (this.banned) {
			return
		}
		this.banned = true
		this.view.renderBanned()
	}

	// Set post as deleted
	public setDeleted() {
		if (this.opPost) {
			if (page.thread) {
				location.href = "/"
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

	// Returns, if this post has been seen already
	public seen() {
		if (this.seenOnce) {
			return true
		}
		if (document.hidden) {
			return false
		}
		if (this.seenOnce = this.view.scrolledPast()) {
			storeSeenPost(this.id, this.op)
		}
		return this.seenOnce
	}
}

function endsWithTag(body: string): boolean {
	switch (body[body.length - 1]) {
		case ">":
			return true
		case "*":
			return body[body.length - 2] === "*"
		case "`":
			return body[body.length - 2] === "`"
	}
	return false
}
