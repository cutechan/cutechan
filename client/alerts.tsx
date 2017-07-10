/**
 * Simple notification system with auto-disposable messages.
 * Can be triggered from anywhere.
 */

import { h, render, Component } from "preact"
import { ALERTS_CONTAINER_SEL, ALERT_HIDE_TIMEOUT_SECS } from "./vars"
import { HOOKS, hook, unhook, trigger } from "./util"

interface Alert {
	id?: number
	title?: string
	message: string
	sticky?: boolean
}

class Alerts extends Component<any, any> {
	private id = 0
	state = {
		alerts: [] as [Alert]
	}
	componentDidMount() {
		hook(HOOKS.showAlert, this.show)
	}
	componentWillUnmount() {
		unhook(HOOKS.showAlert, this.show)
	}
	show = (a: Alert) => {
		a = Object.assign({}, a, {id: this.id++})
		const alerts = [a].concat(this.state.alerts)
		this.setState({alerts})
		if (!a.sticky) {
			setTimeout(this.Hide(a.id), ALERT_HIDE_TIMEOUT_SECS * 1000)
		}
	}
	Hide(id: number) {
		return () => {
			const alerts = this.state.alerts.filter(a => a.id !== id)
			this.setState({alerts})
		}
	}
	renderTitle(title: string) {
		if (!title) return null
		return (
			<div class="alert-title">{title}</div>
		)
	}
	renderAlert = ({ id, title, message }: Alert) => {
		return (
			<div class="alert clearfix" key={id.toString()}>
				<a class="control alert-close-control" onClick={this.Hide(id)}>
					<i class="fa fa-remove" />
				</a>
				{this.renderTitle(title)}
				<div class="alert-message">{message}</div>
			</div>
		)
	}
	render({}, { alerts }: any) {
		return (
			<div class="alerts-container-inner">
				{alerts.map(this.renderAlert)}
			</div>
		)
	}
}

function show(a: Alert | string) {
	if (typeof a === "string") {
		a = {message: a}
	}
	trigger(HOOKS.showAlert, a)
}
export { show }
export { show as showAlert }

export function init() {
	const container = document.querySelector(ALERTS_CONTAINER_SEL)
	if (container) {
		render(<Alerts/>, container)
	}
}
