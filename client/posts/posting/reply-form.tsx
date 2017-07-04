import { h, render, Component } from "preact";

export class ReplyForm extends Component<any, any> {
	render() {
		return (
			<div class="reply-form">
				test
			</div>
		)
	}
}

export function open() {
	const container = document.getElementById("bottom-spacer")
	render(<ReplyForm/>, container)
}
