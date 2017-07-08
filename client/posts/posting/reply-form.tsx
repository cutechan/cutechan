import * as cx from "classnames"
import { h, render, Component } from "preact"
import { ln } from "../../lang"
import { page, boards } from "../../state"
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

class Thumb extends Component<any, any> {
	shouldComponentUpdate({ file }: any) {
		// Prevents image flashing.
		return this.props.file !== file
	}
	render({ file }: any) {
		const previewURL = URL.createObjectURL(file)
		return (
			<img class="reply-file-thumb" src={previewURL} />
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
		const { board, subject, body, files } = this.state
		const fn = page.thread ? API.post.createWS : API.thread.create
		this.setState({sending: true})
		fn({board, subject, body, files}).then((res: Dict) => {
			if (page.thread) {
				this.handleFormHide()
				scrollToBottom()
			} else {
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
	renderFilePreview() {
		const { files } = this.state
		if (!files.length) return null
		// Only single file is supported at the moment.
		const file = files[0]
		return (
			<div class="reply-file-previews" key="files">
				<div class="reply-file-preview">
					<Thumb file={file} />
					<a class="control reply-remove-file-control" onClick={this.handleAttachRemove}>
						<i class="fa fa-remove" />
					</a>
				</div>
			</div>
		);
	}
	render({}, { float, sending, body }: any) {
		return (
			<div class="reply-form" ref={s(this, "mainEl")} style={this.style}>
				{this.renderFilePreview()}
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
