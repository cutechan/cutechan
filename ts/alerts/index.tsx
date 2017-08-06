/**
 * Simple notification system with auto-disposable messages.
 * Can be triggered from anywhere.
 */

import { Component, h, render } from "preact";
import { hook, HOOKS, trigger, unhook } from "../util";
import { ALERT_HIDE_TIMEOUT_SECS, ALERTS_CONTAINER_SEL } from "../vars";

interface Alert {
  id?: number;
  title?: string;
  message: string;
  sticky?: boolean;
}

class Alerts extends Component<any, any> {
  public state = {
    alerts: [] as Alert[],
  };
  private id = 0;
  public componentDidMount() {
    hook(HOOKS.showAlert, this.show);
  }
  public componentWillUnmount() {
    unhook(HOOKS.showAlert, this.show);
  }
  public render({}, { alerts }: any) {
    return (
      <div class="alerts-container-inner">
        {alerts.map(this.renderAlert)}
      </div>
    );
  }
  private show = (a: Alert) => {
    a = Object.assign({}, a, {id: this.id++});
    const alerts = [a].concat(this.state.alerts);
    this.setState({alerts});
    if (!a.sticky) {
      setTimeout(this.makeHide(a.id), ALERT_HIDE_TIMEOUT_SECS * 1000);
    }
  }
  private makeHide(id: number) {
    return () => {
      const alerts = this.state.alerts.filter((a) => a.id !== id);
      this.setState({alerts});
    };
  }
  private renderTitle(title: string) {
    if (!title) return null;
    return (
      <div class="alert-title">{title}</div>
    );
  }
  private renderAlert = ({ id, title, message }: Alert) => {
    return (
      <div class="alert" key={id.toString()}>
        <a class="control alert-close-control" onClick={this.makeHide(id)}>
          <i class="fa fa-remove" />
        </a>
        {this.renderTitle(title)}
        <div class="alert-message">{message}</div>
      </div>
    );
  }
}

function show(a: Alert | Error | string) {
  if (typeof a === "string") {
    a = {message: a};
  } else if (a instanceof Error) {
    a = {message: a.message};
  }
  trigger(HOOKS.showAlert, a);
}
export { show };
export { show as showAlert };

export function init() {
  const container = document.querySelector(ALERTS_CONTAINER_SEL);
  if (container) {
    render(<Alerts/>, container);
  }
}
