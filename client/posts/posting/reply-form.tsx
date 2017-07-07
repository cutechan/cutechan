import * as cx from "classnames"
import { h, render, Component } from "preact"
import { ln } from "../../lang"
import { page, boards } from "../../state"
import { Dict, ShowHide, on, scrollToTop } from "../../util"
import API from "../../api"
import {
	REPLY_CONTAINER_SEL,
	BOARD_NEW_THREAD_BUTTON_SEL,
	THREAD_REPLY_BUTTON_SEL
} from "../../vars"

function s(self: any, name: string) {
	return function(el: Element) {
		self[name] = el
	}
}

class Thumb extends Component<any, any> {
	shouldComponentUpdate({ file }: any, {}) {
		// Prevents image flashing.
		return this.props.file !== file
	}
	render({ file }: any, {}) {
		const previewURL = URL.createObjectURL(file)
		return (
			<img class="reply-file-thumb" src={previewURL} />
		)
	}
}

class Reply extends Component<any, any> {
	private bodyEl: HTMLInputElement
	private fileEl: HTMLInputElement
	state = {
		sending: false,
		board: page.board === "all" ? boards[0] : page.board,
		subject: "",
		body: "",
		files: [] as [File],
	}
	componentDidMount() {
		this.bodyEl.focus()
		if (page.thread) {
			this.bodyEl.scrollIntoView()
		} else {
			scrollToTop()
		}
	}
	componentDidUpdate() {
		this.recalcTextareaHeight()
	}
	recalcTextareaHeight() {
		// See <https://stackoverflow.com/a/995374>.
		this.bodyEl.style.height = "1px"
		this.bodyEl.style.height = this.bodyEl.scrollHeight + "px"
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
		this.recalcTextareaHeight()
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
		this.setState({files: [file]})
	}
	handleSend = () => {
		const { board, subject, body, files } = this.state
		const fn = page.thread ? API.post.createWS : API.thread.create
		this.setState({sending: true})
		fn({ board, subject, body, files }).then((res: Dict) => {
			if (page.thread) {
				this.handleFormHide()
			} else {
				location.href = `/${board}/${res.id}`
			}
		}, () => {
			// FIXME(Kagami): Trigger notification.
		}).then(() => {
			this.setState({sending: false})
		})
	}
	get invalid() {
		const { subject, body, files } = this.state
		return !subject || (!body && !files.length)
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
	render({}, { sending, body }: any) {
		return (
			<div class="reply-form">
				{this.renderFilePreview()}
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
						<a class="control reply-control reply-attach-control" onClick={this.handleAttach}>
							<i class="fa fa-file-image-o" />
						</a>
					</div>
				</div>
				<div class="reply-side-controls reply-controls">
					<a class="control reply-control reply-form-hide-control" onClick={this.handleFormHide}>
						<i class="fa fa-remove" />
					</a>
					<a class="control reply-control reply-form-move-control">
						<i class="fa fa-arrows-alt" />
					</a>
					<button
						class="control reply-control reply-send-control"
						disabled={sending || this.invalid}
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
	}
	componentDidMount() {
		on(document, "click", () => {
			this.setState({show: true})
		}, {
			selector: [BOARD_NEW_THREAD_BUTTON_SEL, THREAD_REPLY_BUTTON_SEL],
		})
	}
	handleHide = () => {
		this.setState({show: false})
	}
	render({}, { show, thread }: any) {
		return (
			<ShowHide show={show}>
				<Reply onHide={this.handleHide} />
			</ShowHide>
		)
	}
}

export default function() {
	const container = document.querySelector(REPLY_CONTAINER_SEL)
	if (container) {
		render(<ReplyContainer/>, container)
	}
}
