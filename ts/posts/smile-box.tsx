/**
 * Smile box widget with autocomplete feature.
 */

import * as cx from "classnames";
import { Component, h } from "preact";
import * as getCaretCoordinates from "textarea-caret";
import smiles from "../../smiles-pp/smiles";

export function shouldAutocomplete(el: HTMLTextAreaElement): boolean {
  return false;
}

export default class extends Component<any, any> {
  private smileList: string[];

  public componentWillMount() {
    this.smileList = Array.from(smiles).sort();
    if (this.props.autocomplete) {
      const el = this.props.textarea;
      const { left, top } = getCaretCoordinates(el, el.selectionEnd);
      this.setState({left, top});
    }
  }
  public componentDidMount() {
    document.addEventListener("keydown", this.handleGlobalKey);
    document.addEventListener("click", this.handleGlobalClick);
  }
  public componentWillUnmount() {
    document.removeEventListener("keydown", this.handleGlobalKey);
    document.removeEventListener("click", this.handleGlobalClick);
  }
  private handleGlobalKey = (e: KeyboardEvent) => {
    if (e.keyCode === 27) {
      this.props.onClose();
    }
  }
  private handleGlobalClick = (e: MouseEvent) => {
    if (e.button === 0) {
      this.props.onClose();
    }
  }
  private handleSmileBoxClick = (e: MouseEvent) => {
    e.stopPropagation();
  }
  private handleSmileClick = (id: string) => {
    this.props.onSelect(id);
  }
  public render({ autocomplete }: any, { left, top }: any) {
    return (
      <div
        class={cx("smile-box", {
          "smile-box_full": !autocomplete,
          "smile-box_autocomplete": autocomplete,
        })}
        style={{left, top}}
        onClick={this.handleSmileBoxClick}
      >
        <div class="smiles">
          {this.smileList.map((id) =>
            <div class="smiles-item">
              <i
                class={cx("smile", `smile-${id}`, "smiles-icon")}
                title={`:${id}:`}
                onClick={this.handleSmileClick.bind(null, id)}
              />
            </div>,
          )}
        </div>
      </div>
    );
  }
}
