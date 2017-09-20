/**
 * Smile box widget with autocomplete feature.
 */

import * as cx from "classnames";
import { Component, h } from "preact";
import * as getCaretCoordinates from "textarea-caret";
import smiles from "../../smiles-pp/smiles";
import { reverse } from "../util";

const smileList = Array.from(smiles).sort();

const KEY_A = 97;
const KEY_Z = 122;
const KEY_0 = 48;
const KEY_9 = 57;
const KEY_UND = 95;
const KEY_CLN = 58;
const KEY_SPC = 32;
const KEY_NL = 10;
const KEY_ESC = 27;

function isSmileID(c: number): boolean {
  return (
    (c >= KEY_A && c <= KEY_Z) || (c >= KEY_0 && c <= KEY_9) || c === KEY_UND
  );
}

/**
 * Try to autocomplete textarea input.
 *
 * This should be pretty fast because we execute it on each new
 * character.
 */
export function autocomplete(el: HTMLTextAreaElement): string[] | null {
  const start = el.selectionStart;
  const pos = el.selectionEnd;
  if (start !== pos) return null;
  if (pos < 4) return null;

  const body = el.value;
  const len = body.length;
  const nextCh = (pos < len) ? body.charCodeAt(pos) : 0;
  if (nextCh && nextCh !== KEY_SPC && nextCh !== KEY_NL) return null;

  let i = pos - 1;
  let chunk = "";
  let colon = false;
  for (; i >= 0; i--) {
    const c = body.charCodeAt(i);
    if (isSmileID(c)) {
      // Append to the end because it's more effecient.
      chunk += body[i];
      // Ignore too long matches.
      if (chunk.length > 10) return null;
    } else if (c === KEY_CLN) {
      colon = true;
      break;
    } else {
      return null;
    }
  }

  if (!colon) return null;
  if (chunk.length < 3) return null;
  const prevCh = (i > 0) ? body.charCodeAt(i - 1) : 0;
  if (prevCh && prevCh !== KEY_SPC && prevCh !== KEY_NL) return null;

  chunk = reverse(chunk);
  const matches = smileList.filter((s) => s.includes(chunk));
  return matches.length ? matches : null;
}

export default class extends Component<any, any> {
  public state = {
    left: 0,
    top: 0,
  };
  public componentWillMount() {
    this.setAutocompletePos();
  }
  public componentDidMount() {
    document.addEventListener("keydown", this.handleGlobalKey);
    document.addEventListener("click", this.handleGlobalClick);
  }
  public componentWillUnmount() {
    document.removeEventListener("keydown", this.handleGlobalKey);
    document.removeEventListener("click", this.handleGlobalClick);
  }
  public componentWillReceiveProps({ body }: any) {
    if (body !== this.props.body) {
      this.setAutocompletePos();
    }
  }
  private setAutocompletePos() {
    if (this.props.acList) {
      const el = this.props.textarea;
      let { left, top } = getCaretCoordinates(el, el.selectionEnd);
      left += 10;
      top -= 30;
      this.setState({left, top});
    }
  }
  private handleGlobalKey = (e: KeyboardEvent) => {
    if (e.keyCode === KEY_ESC) {
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
  public render({ acList }: any, { left, top }: any) {
    const style = acList ? { left, top } : null;
    return (
      <div
        class={cx("smile-box", {
          "smile-box_full": !acList,
          "smile-box_autocomplete": !!acList,
        })}
        style={style}
        onClick={this.handleSmileBoxClick}
      >
        <div class="smiles">
          {(acList || smileList).map((id: string) =>
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
