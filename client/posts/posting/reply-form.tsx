import lang from "../../lang"
import { h, render, Component } from "preact"
import { on, ShowHide } from "../../util"
import { postSM, postEvent, postState } from "."
import FormModel from "./model"

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

class Form extends Component<any, any> {
	private bodyEl: HTMLInputElement
	private fileEl: HTMLInputElement
	state = {
		sending: false,
		body: "",
		files: [] as [File],
	}
	componentDidMount() {
		this.bodyEl.focus()
		this.bodyEl.scrollIntoView()
	}
	handleFormHide = () => {
		this.props.onHide()
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
		}).then(() => {
			this.setState({sending: false})
		})
	}
	renderFilePreview() {
		const { files } = this.state
		if (!files.length) return null
		// Only single file is supported at the moment.
		const file = files[0]
		const previewUrl = URL.createObjectURL(file)
		return (
			<div class="reply-file-previews">
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
				<div class="reply-header">
					<div class="reply-header-controls">
						<a class="control reply-hide-form-control" onClick={this.handleFormHide}>
							<i class="fa fa-remove" />
						</a>
					</div>
				</div>
				{this.renderFilePreview()}
				<textarea
					class="reply-body"
					ref={s(this, "bodyEl")}
					value={body}
					disabled={sending}
					onChange={this.handleBodyChange}
				/>
				<div class="reply-buttons">
					<button
						class="button reply-attach-button"
						disabled={sending}
						onClick={this.handleAttach}
					>
						{lang.ui.attach}
					</button>
					<button
						class="button reply-send-button"
						disabled={sending}
						onClick={this.handleSend}
					>
						<ShowHide show={sending}>
							<i class="spinner fa fa-spinner fa-pulse fa-fw" />
						</ShowHide>
						{lang.ui.send}
					</button>
				</div>
				<input
					class="reply-file-input"
					ref={s(this, "fileEl")}
					type="file"
					onChange={this.handleFileLoad}
				/>
			</div>
		)
	}
}

class FormContainer extends Component<any, any> {
	state = {
		show: false,
	}
	componentDidMount() {
		on(document, "click", () => {
			this.setState({show: true})
		}, {
			selector: ".thread-navigation-reply",
		})
	}
	handleHide = () => {
		this.setState({show: false})
	}
	render({}, {show}: any) {
		return (
			<ShowHide show={show}>
				<Form onHide={this.handleHide} />
			</ShowHide>
		)
	}
}

export default function() {
	const container = document.getElementById("bottom-spacer")
	render(<FormContainer/>, container)
}
