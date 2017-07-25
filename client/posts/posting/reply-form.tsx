import * as cx from "classnames"
import { h, render, Component } from "preact"
import { ln, printf } from "../../lang"
import { config, page, boards, storeMine } from "../../state"
import API from "../../api"
import * as signature from "./signature"
import { showAlert } from "../../alerts"
import { duration, fileSize } from "../../templates"
import {
	POST_SEL,
	POST_BODY_SEL,
	REPLY_CONTAINER_SEL,
	TRIGGER_OPEN_REPLY_SEL,
	TRIGGER_QUOTE_POST_SEL,
	REPLY_THREAD_WIDTH_PX,
	REPLY_BOARD_WIDTH_PX,
} from "../../vars"
import {
	Dict, ShowHide, on, scrollToTop,
	HOOKS, hook, unhook,
	getID,
} from "../../util"

function s(self: any, name: string) {
	return function(el: Element) {
		self[name] = el
	}
}

function quoteText(text: string): string {
  return text.trim().split(/\n/).filter(function(line) {
    return line.length > 0;
  }).map(function(line) {
    return ">" + line;
  }).join("\n") + "\n";
}


function getImageInfo(file: File, skipCopy: boolean): Promise<Dict> {
	return new Promise((resolve, reject) => {
		let url = URL.createObjectURL(file)
		const img = new Image();
		img.onload = () => {
			const { width, height } = img
			if (skipCopy) {
				resolve({ width, height, url })
				return
			}
			const c = document.createElement("canvas")
			const ctx = c.getContext("2d")
			c.width = width
			c.height = height
			ctx.drawImage(img, 0, 0, width, height)
			url = c.toDataURL()
			resolve({ width, height, url })
		}
		img.onerror = reject
		img.src = url
	})
}

function getVideoInfo(file: File): Promise<Dict> {
	return new Promise((resolve, reject) => {
		const vid = document.createElement("video");
		vid.muted = true;
		vid.onloadeddata = () => {
			const { videoWidth: width, videoHeight: height, duration: dur } = vid
			if (!width || !height) {
				reject(new Error())
				return
			}
			const c = document.createElement("canvas")
			const ctx = c.getContext("2d")
			c.width = width
			c.height = height
			ctx.drawImage(vid, 0, 0, width, height)
			const url = c.toDataURL()
			resolve({ width, height, dur, url })
		}
		vid.onerror = reject
		vid.src = URL.createObjectURL(file)
	})
}

function getFileInfo(file: File): Promise<Dict> {
	let fn = null
	let skipCopy = false
	if (file.type.startsWith("video/")) {
		fn = getVideoInfo
	} else {
		fn = getImageInfo
		// TODO(Kagami): Dump first frame of APNG and animated WebP.
		if (file.type !== "image/gif") {
			skipCopy = true
		}
	}
	return fn(file, skipCopy)
}

class FilePreview extends Component<any, any> {
	handleRemove = () => {
		this.props.onRemove()
	}
	renderInfo(): string {
		const { size } = this.props.file
		const { width, height, dur } = this.props.info
		let s = `${width}×${height}, ${fileSize(size)}`
		if (dur) {
			s += `, ${duration(dur)}`
		}
		return s
	}
	render(props: any) {
		const url = props.info.url
		return (
			<div class="reply-file-preview">
				<a class="control reply-remove-file-control" onClick={this.handleRemove}>
					<i class="fa fa-remove" />
				</a>
				<img class="reply-file-thumb" src={url} />
				<div class="reply-file-info">{this.renderInfo()}</div>
			</div>
		)
	}
}

class Reply extends Component<any, any> {
	private mainEl: HTMLElement = null
	private bodyEl: HTMLInputElement = null
	private fileEl: HTMLInputElement = null
	private moving = false
	private resizing = false
	private baseX = 0
	private baseY = 0
	private startX = 0
	private startY = 0
	state = {
		float: false,
		left: 0,
		top: 0,
		width: page.thread ? REPLY_THREAD_WIDTH_PX : REPLY_BOARD_WIDTH_PX,
		height: "auto",
		sending: false,
		board: page.board === "all" ? boards[0].id : page.board,
		thread: page.thread,
		subject: "",
		body: "",
		files: [] as [{file: File, info: Dict}],
	}
	componentWillMount() {
		const { quoted } = this.props
		if (quoted) {
			this.quote(quoted)
			this.setFloat(quoted)
		}
	}
	componentDidMount() {
		hook(HOOKS.openReply, this.focus)
		hook(HOOKS.sendReply, this.handleSend)
		hook(HOOKS.selectFile, this.handleAttach)
		document.addEventListener(
			"mousemove",
			this.handleGlobalMove,
			{passive: true}
		)
		document.addEventListener(
			"mouseup",
			this.handleGlobalUp,
			{passive: true}
		)
		this.focus()
		const caret = this.state.body.length
		this.bodyEl.setSelectionRange(caret, caret)
	}
	componentWillUnmount() {
		unhook(HOOKS.openReply, this.focus)
		unhook(HOOKS.sendReply, this.handleSend)
		unhook(HOOKS.selectFile, this.handleAttach)
		document.removeEventListener(
			"mousemove",
			this.handleGlobalMove,
			{passive: true}
		)
		document.removeEventListener(
			"mouseup",
			this.handleGlobalUp,
			{passive: true}
		)
	}
	componentWillReceiveProps({ quoted }: any) {
		if (quoted !== this.props.quoted) {
			if (quoted) {
				this.quote(quoted)
			} else {
				this.handleFormPin()
			}
		}
	}
	get style() {
		const { float, left, top, width, height } = this.state
		const o = {width, height}
		if (float) {
			Object.assign(o, {position: "fixed", left, top})
		}
		return o
	}
	get invalid() {
		const { subject, body, files } = this.state
		const hasSubject = !!subject || !!page.thread
		return !hasSubject || (!body && !files.length)
	}
	get disabled() {
		const { sending } = this.state
		return sending || this.invalid
	}
	quote(e: MouseEvent) {
		const post = (e.target as Element).closest(POST_SEL)
		const postBody = post.querySelector(POST_BODY_SEL)
		const postID = getID(post)
		let { body } = this.state
		let start = 0
		let end = 0
		if (this.bodyEl) {
			start = this.bodyEl.selectionStart
			end = this.bodyEl.selectionEnd
		}

		let cited = ""
		if (!body.includes(postID.toString())) {
			cited += `>>${postID}\n`
		}

		const sel = window.getSelection()
		if (!sel.isCollapsed
				&& postBody.contains(sel.anchorNode)
				&& postBody.contains(sel.focusNode)) {
			cited += quoteText(sel.toString())
		}

		const caret = start + cited.length
		if (end < body.length) {
			cited += "\n"
		}
		body = body.slice(0, start) + cited + body.slice(end)
		this.setState({body}, () => {
			// Don't focus invisible element.
			if (this.bodyEl && this.bodyEl.offsetParent !== null) {
				this.focus()
				this.bodyEl.setSelectionRange(caret, caret)
			}
		})
	}
	setFloat(e: MouseEvent) {
		const float = true
		const left = 300
		const top = 300
		this.setState({float, left, top})
	}
	focus = () => {
		this.bodyEl.focus()
		if (page.thread) {
			if (!this.state.float) {
				this.bodyEl.scrollIntoView()
			}
		} else {
			scrollToTop()
		}
	}
	handleMoveDown = (e: MouseEvent) => {
		e.preventDefault()
		this.moving = true
		this.baseX = e.clientX
		this.baseY = e.clientY
		const rect = this.mainEl.getBoundingClientRect()
		this.startX = rect.left
		this.startY = rect.top
	}
	handleResizeDown = (e: MouseEvent) => {
		e.preventDefault()
		this.resizing = true
		this.baseX = e.clientX
		this.baseY = e.clientY
		this.startX = this.mainEl.offsetWidth;
		this.startY = this.mainEl.offsetHeight;
	}
	handleGlobalMove = (e: MouseEvent) => {
		if (this.moving) {
			this.setState({
				float: true,
				left: this.startX + e.clientX - this.baseX,
				top: this.startY + e.clientY - this.baseY,
			})
		} else if (this.resizing) {
			this.setState({
				width: this.startX + e.clientX - this.baseX,
				height: this.startY + e.clientY - this.baseY,
			})
		}
	}
	handleGlobalUp = () => {
		this.moving = false
		this.resizing = false
	}
	handleFormPin = () => {
		this.setState({float: false}, this.focus)
	}
	handleFormHide = () => {
		this.props.onHide()
	}
	handleSubjectChange = (e: any) => {
		this.setState({subject: e.target.value})
	}
	handleBoardChange = (e: any) => {
		this.setState({board: e.target.value})
	}
	handleBodyChange = (e: any) => {
		this.setState({body: e.target.value})
	}
	handleAttach = () => {
		this.fileEl.click()
	}
	handleAttachRemove = () => {
		this.setState({files: []})
	}
	handleFileLoad = () => {
		const file = this.fileEl.files[0]
		// Allow to select same file again.
		this.fileEl.value = null

		if (file.size > config.maxSize<<20) {
			showAlert(ln.UI["tooBig"])
			return
		}

		// Add file only if was able to grab info.
		getFileInfo(file).then((info: Dict) => {
			const files = [{file, info}]
			this.setState({files})
		}, () => {
			showAlert(ln.UI["unsupFile"])
		})
	}
	handleSend = () => {
		if (this.disabled) return
		const { board, thread, subject, body } = this.state
		const files = this.state.files.map(f => f.file)
		const sign = signature.gen()
		const fn = page.thread ? API.post.create : API.thread.create
		this.setState({sending: true})
		fn({board, thread, subject, body, files, sign}).then((res: Dict) => {
			if (page.thread) {
				storeMine(res.id, page.thread)
				this.handleFormHide()
			} else {
				storeMine(res.id, res.id)
				location.href = `/${board}/${res.id}`
			}
		}, ({ message }: Error) => {
			showAlert({title: ln.UI.sendErr, message})
		}).then(() => {
			this.setState({sending: false})
		})
	}
	renderBoards() {
		if (page.board !== "all") return null;
		const { sending, board } = this.state
		return (
			<select
				class="reply-board"
				value={board}
				disabled={sending}
				onInput={this.handleBoardChange}
			>
				{boards.map(({ id }) =>
				<option class="reply-board-item" key={id} value={id}>{id}</option>
				)}
			</select>
		)
	}
	renderHeader() {
		if (page.thread) return null;
		const { sending, subject } = this.state
		return (
			<div class="reply-header" key="header">
				{this.renderBoards()}
				<input
					class="reply-subject"
					placeholder={ln.UI.subject + "∗"}
					value={subject}
					disabled={sending}
					onInput={this.handleSubjectChange}
				/>
			</div>
		);
	}
	renderPreviews() {
		const { files } = this.state
		if (!files.length) return null
		// Only single file is supported at the moment.
		const file = files[0]
		return (
			<div class="reply-file-previews" key="files">
				<FilePreview {...file} onRemove={this.handleAttachRemove} />
			</div>
		);
	}
	render({}, { float, sending, body }: any) {
		return (
			<div class={cx("reply", {"reply_float": float})} ref={s(this, "mainEl")} style={this.style}>
				{this.renderPreviews()}
				<div class="reply-content">
					{this.renderHeader()}
					<textarea
						class="reply-body"
						ref={s(this, "bodyEl")}
						value={body}
						disabled={sending}
						onInput={this.handleBodyChange}
					/>
					<div class="reply-footer-controls reply-controls">
						<button
							class="control reply-control reply-attach-control"
							title={printf(ln.UI["attach"], fileSize(config.maxSize<<20))}
							disabled={sending}
							onClick={this.handleAttach}
						>
							<i class="fa fa-file-image-o" />
						</button>
					</div>
				</div>
				<div class="reply-side-controls reply-controls">
					<a class="control reply-control reply-hide-control" onClick={this.handleFormHide}>
						<i class="fa fa-remove" />
					</a>
					<a class="control reply-control reply-move-control" onMouseDown={this.handleMoveDown}>
						<i class="fa fa-arrows-alt" />
					</a>
					<ShowHide show={float}>
						<a class="control reply-control reply-pin-control" onClick={this.handleFormPin}>
							<i class="fa fa-thumb-tack" />
						</a>
					</ShowHide>
					<button
						class="control reply-control reply-send-control"
						disabled={this.disabled}
						onClick={this.handleSend}
					>
						<i class={cx("fa", {
							"fa-check": !sending,
							"fa-spinner fa-pulse fa-fw": sending,
							"hidden": this.invalid,
						})} />
					</button>
				</div>
				<input
					class="reply-file-input"
					ref={s(this, "fileEl")}
					type="file"
					accept="image/*,video/*"
					onChange={this.handleFileLoad}
				/>
				<i class="reply-resize" onMouseDown={this.handleResizeDown} />
			</div>
		)
	}
}

class ReplyContainer extends Component<any, any> {
	state = {
		show: false,
		quoted: null as Element,
	}
	componentDidMount() {
		hook(HOOKS.openReply, () => {
			this.setState({show: true, quoted: null})
		})
		on(document, "click", () => {
			this.setState({show: true, quoted: null})
		}, {selector: TRIGGER_OPEN_REPLY_SEL})
		on(document, "click", e => {
			this.setState({show: true, quoted: e})
		}, {selector: TRIGGER_QUOTE_POST_SEL})
	}
	handleHide = () => {
		this.setState({show: false})
	}
	render({}, { show, quoted }: any) {
		return (
			<ShowHide show={show}>
				<Reply quoted={quoted} onHide={this.handleHide} />
			</ShowHide>
		)
	}
}

export function init() {
	const container = document.querySelector(REPLY_CONTAINER_SEL)
	if (container) {
		render(<ReplyContainer/>, container)
	}
}
