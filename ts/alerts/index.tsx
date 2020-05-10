/**
 * Simple notification system with auto-disposable messages.
 * Can be triggered from anywhere.
 *
 * @module cutechan/alerts
 */

import * as cx from "classnames";
import { Component, h, render } from "preact";
import _ from "../lang";
import { hook, HOOKS, trigger, unhook } from "../util";
import { ALERT_HIDE_TIMEOUT_SECS, ALERTS_CONTAINER_SEL } from "../vars";

interface Alert {
  id?: number;
  title?: string;
  message: string;
  sticky?: boolean;
  closing?: boolean;
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
      <div class="alerts-container-inner">{alerts.map(this.renderAlert)}</div>
    );
  }
  private show = (a: Alert) => {
    a = Object.assign({}, a, { id: this.id++ });
    const alerts = [a].concat(this.state.alerts);
    this.setState({ alerts });
    if (!a.sticky) {
      setTimeout(this.makeClose(a.id), ALERT_HIDE_TIMEOUT_SECS * 1000);
    }
  };
  private makeClose(id: number, force = false) {
    return () => {
      let alerts = this.state.alerts;

      if (force) {
        alerts = alerts.filter((a) => a.id !== id);
        this.setState({ alerts });
        return;
      }

      alerts = alerts.map((a) => (a.id === id ? { ...a, closing: true } : a));
      this.setState({ alerts });
      setTimeout(() => {
        alerts = this.state.alerts.filter((a) => a.id !== id);
        this.setState({ alerts });
      }, 1000);
    };
  }
  private renderAlert = ({ id, title, message, closing }: Alert) => {
    return (
      <article
        class={cx("alert", closing && "alert_closing")}
        key={id.toString()}
      >
        <a
          class="control alert-close-control"
          onClick={this.makeClose(id, true)}
        >
          <i class="fa fa-remove" />
        </a>
        {this.renderTitle(title)}
        <section class="alert-message">{message}</section>
      </article>
    );
  };
  private renderTitle(title: string) {
    return title ? <header class="alert-title">{title}</header> : null;
  }
}

export function showAlert(a: Alert | Error | string | [string, Error]) {
  if (typeof a === "string") {
    a = { message: a };
  } else if (a instanceof Error) {
    a = { message: a.message };
  } else if (Array.isArray(a)) {
    a = { title: a[0], message: a[1].message };
  }
  trigger(HOOKS.showAlert, a);
}

export function showSendAlert(err: Error) {
  showAlert([_("sendErr"), err]);
}

export function init() {
  const container = document.querySelector(ALERTS_CONTAINER_SEL);
  if (container) {
    render(<Alerts />, container);
  }
}
