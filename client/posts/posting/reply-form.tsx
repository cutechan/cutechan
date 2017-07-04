import lang from "../../lang"
import { h, render, Component } from "preact"

function s(self: any, name: string) {
	return function(el: Element) {
		self[name] = el
	}
}

class ReplyForm extends Component<any, any> {
	private fileEl: HTMLInputElement
	state = {
		body: "",
		files: [] as [File],
	}
	handleFormHide = () => {
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
	render({}, {body}: any) {
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
					value={body}
					onChange={this.handleBodyChange}
				/>
				<div class="reply-buttons">
					<a class="button reply-attach-button" onClick={this.handleAttach}>{lang.ui.attach}</a>
					<a class="button reply-send-button" onClick={this.handleSend}>{lang.ui.send}</a>
				</div>
				<input
					ref={s(this, "fileEl")}
					type="file"
					class="reply-file-input"
					onChange={this.handleFileLoad}
				/>
			</div>
		)
	}
}

export function open() {
	const container = document.getElementById("bottom-spacer")
	render(<ReplyForm/>, container)
}
