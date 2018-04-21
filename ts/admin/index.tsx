/**
 * Admin page UI.
 *
 * @module cutechan/admin
 */

import { Component, h, render } from "preact";
import { ADMIN_CONTAINER_SEL } from "../vars";

class Admin extends Component<{}, {}> {
  public render() {
    return <i/>;
  }
}

export function init() {
  const container = document.querySelector(ADMIN_CONTAINER_SEL);
  if (container) {
    render(<Admin />, container);
  }
}
