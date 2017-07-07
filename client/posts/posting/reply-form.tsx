import * as cx from "classnames"
import { h, render, Component } from "preact"
import { ln } from "../../lang"
import { page, boards } from "../../state"
import { ShowHide, on, scrollToTop } from "../../util"
import { postSM, postEvent, postState } from "."
import FormModel from "./model"
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

function sendPost(body: string): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		postSM.act(postState.ready, postEvent.open, () => {
			return postState.sendingNonLive
		})
		postSM.act(postState.sendingNonLive, postEvent.done, () => {
			resolve()
			return postState.ready
		})

		postSM.feed(postEvent.open)
		const model = new FormModel()
		model.parseInput(body)
		model.commitNonLive()
	})
}

class Reply extends Component<any, any> {
	private bodyEl: HTMLInputElement
	private fileEl: HTMLInputElement
	state = {
		sending: false,
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
	handleFormHide = () => {
		this.props.onHide()
	}
	recalcTextareaHeight = () => {
		// See <https://stackoverflow.com/a/995374>.
		this.bodyEl.style.height = "1px"
		this.bodyEl.style.height = this.bodyEl.scrollHeight + "px"
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
		this.fileEl.value = null
		this.setState({files: [file]})
	}
	handleSend = () => {
		this.setState({sending: true})
		sendPost(this.state.body).then(() => {
			this.handleFormHide()
		}, () => {
			// TODO(Kagami): Trigger notification.
			this.setState({sending: false})
		})
	}
	renderBoards() {
		if (page.board !== "all") return null;
		return (
			<select
				class="reply-board"
			>
				{boards.map(b =>
				<option class="reply-board-item">{b}</option>
				)}
			</select>
		)
	}
	renderHeader() {
		if (page.thread) return null;
		return (
			<div class="reply-header" key="header">
				{this.renderBoards()}
				<input
					class="reply-subject"
					placeholder={ln.UI.subject + "∗"}
				/>
			</div>
		);
	}
	renderFilePreview() {
		const { files } = this.state
		if (!files.length) return null
		// Only single file is supported at the moment.
		const file = files[0]
		const previewUrl = URL.createObjectURL(file)
		return (
			<div class="reply-file-previews" key="files">
				<div class="reply-file-preview">
					<img class="reply-file-thumb" src={previewUrl} />
					<a class="control reply-remove-file-control" onClick={this.handleAttachRemove}>
						<i class="fa fa-remove" />
					</a>
				</div>
			</div>
		);
	}
	render({}, {sending, body}: any) {
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
						onInput={this.recalcTextareaHeight}
						onChange={this.handleBodyChange}
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
					<a class="control reply-control reply-send-control" onClick={this.handleSend}>
						<i class={cx("fa", {
							"fa-check": !sending,
							"fa-spinner fa-pulse fa-fw": sending,
						})} />
					</a>
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
	render({}, {show, thread}: any) {
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
