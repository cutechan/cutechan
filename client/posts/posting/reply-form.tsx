import * as cx from "classnames"
import { h, render, Component } from "preact"
import { ln } from "../../lang"
import { page, boards, storeMine } from "../../state"
import { fileSize, duration } from "../../posts"
import API from "../../api"
import { showAlert } from "../../alerts"
import {
	POST_SEL,
	POST_BODY_SEL,
	REPLY_CONTAINER_SEL,
	TRIGGER_OPEN_REPLY_SEL,
	TRIGGER_QUOTE_POST_SEL,
} from "../../vars"
import {
	Dict, ShowHide, on, scrollToTop, scrollToBottom,
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

class FilePreview extends Component<any, any> {
	state = {
		width: 0,
		height: 0,
		dur: 0,  // TODO(Kagami): Fix naming
		url: null as string,
	}
	componentWillMount() {
		this.setFileInfo(this.props.file)
	}
	componentWillReceiveProps({ file }: any) {
		if (file !== this.props.file) {
			this.setFileInfo(file)
		}
	}
	getImageInfo(file: File, skipCopy: boolean): Promise<Dict> {
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
	getVideoInfo(file: File): Promise<Dict> {
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
	setFileInfo(file: File) {
		let fn = null
		let skipCopy = false
		if (file.type.startsWith("video/")) {
			fn = this.getVideoInfo
		} else {
			fn = this.getImageInfo
			// TODO(Kagami): Dump first frame of APNG and animated WebP.
			if (file.type !== "image/gif") {
				skipCopy = true
			}
		}
		fn(file, skipCopy).then((info: Dict) => {
			this.setState(info)
		}, () => {
			showAlert(ln.UI.unsupFile)
			// A bit stupid but simpler than check in parent component.
			this.handleRemove()
		})
	}
	handleRemove = () => {
		this.props.onRemove()
	}
	get info(): string {
		const { type, size } = this.props.file
		const { width, height, dur } = this.state
		let s = `${width}×${height}, ${fileSize(size)}`
		if (type.startsWith("video/")) {
			s += `, ${duration(dur)}`
		}
		return s
	}
	render({}, { url }: any) {
		if (!url) return null
		return (
			<div class="reply-file-preview">
				<a class="control reply-remove-file-control" onClick={this.handleRemove}>
					<i class="fa fa-remove" />
				</a>
				<img class="reply-file-thumb" src={url} />
				<div class="reply-file-info">{this.info}</div>
			</div>
		)
	}
}

class Reply extends Component<any, any> {
	private mainEl: HTMLElement = null
	private bodyEl: HTMLInputElement = null
	private fileEl: HTMLInputElement = null
	private moving = false
	private baseX = 0
	private baseY = 0
	private startX = 0
	private startY = 0
	state = {
		float: false,
		left: 0,
		top: 0,
		sending: false,
		board: page.board === "all" ? boards[0] : page.board,
		thread: page.thread,
		subject: "",
		body: "",
		files: [] as [File],
	}
	componentWillMount() {
		const { quoted } = this.props
		if (quoted) {
			this.quote(quoted)
			this.setFloat(quoted)
		}
	}
	componentDidMount() {
		hook(HOOKS.sendReply, this.handleSend)
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
	}
	componentWillUnmount() {
		unhook(HOOKS.sendReply, this.handleSend)
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
		const { float, left, top } = this.state
		return float ? {position: "fixed", left, top} : null
	}
	get bodyHeight() {
		// See <https://stackoverflow.com/a/995374>.
		if (!this.bodyEl) return "auto"
		this.bodyEl.style.height = "1px"
		return this.bodyEl.scrollHeight + "px"
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
		let cited = `>>${postID}\n`

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
			if (this.bodyEl) {
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
		this.moving = true
		this.baseX = e.clientX
		this.baseY = e.clientY
		const rect = this.mainEl.getBoundingClientRect()
		this.startX = rect.left
		this.startY = rect.top
	}
	handleGlobalMove = (e: MouseEvent) => {
		if (this.moving) {
			this.setState({
				float: true,
				left: this.startX + e.clientX - this.baseX,
				top: this.startY + e.clientY - this.baseY,
			})
		}
	}
	handleGlobalUp = () => {
		this.moving = false
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
		// XXX(Kagami): Prevents flickering if set early.
		this.bodyEl.style.height = this.bodyHeight
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
		this.setState({files: [file]})
	}
	handleSend = () => {
		if (this.disabled) return
		const { board, thread, subject, body, files } = this.state
		const fn = page.thread ? API.post.create : API.thread.create
		this.setState({sending: true})
		fn({board, thread, subject, body, files}).then((res: Dict) => {
			if (page.thread) {
				storeMine(res.id, page.thread)
				this.handleFormHide()
				scrollToBottom()
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
				{boards.map(b =>
				<option class="reply-board-item" key={b} value={b}>{b}</option>
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
				<FilePreview file={file} onRemove={this.handleAttachRemove} />
			</div>
		);
	}
	render({}, { float, sending, body }: any) {
		return (
			<div class="reply-form" ref={s(this, "mainEl")} style={this.style}>
				{this.renderPreviews()}
				<div class="reply-content">
					{this.renderHeader()}
					<textarea
						class="reply-body"
						style={{height: this.bodyHeight}}
						ref={s(this, "bodyEl")}
						value={body}
						disabled={sending}
						onInput={this.handleBodyChange}
					/>
					<div class="reply-footer-controls reply-controls">
						<a class="control reply-control reply-attach-control" onClick={this.handleAttach}>
							<i class="fa fa-file-image-o" />
						</a>
					</div>
				</div>
				<div class="reply-side-controls reply-controls">
					<a class="control reply-control reply-form-hide-control" onClick={this.handleFormHide}>
						<i class="fa fa-remove" />
					</a>
					<a class="control reply-control reply-form-move-control" onMouseDown={this.handleMoveDown}>
						<i class="fa fa-arrows-alt" />
					</a>
					<ShowHide show={float}>
						<a class="control reply-control reply-form-pin-control" onClick={this.handleFormPin}>
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
			this.setState({show: true})
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
