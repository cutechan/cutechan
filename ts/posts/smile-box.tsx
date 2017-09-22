/**
 * Smile box widget with autocomplete feature.
 */

import * as cx from "classnames";
import { Component, h } from "preact";
import * as getCaretCoordinates from "textarea-caret";
import smiles from "../../smiles-pp/smiles";
import { reverse, setter } from "../util";

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
const KEY_LEFT = 37;
const KEY_RIGHT = 39;
const KEY_UP = 38;
const KEY_DOWN = 40;
const KEY_HOME = 36;
const KEY_END = 35;
const KEY_ENTER = 13;

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
    cur: 0,
  };
  private listEl: HTMLElement = null;
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
  public componentWillReceiveProps({ body, acList }: any) {
    if (body !== this.props.body) {
      this.setAutocompletePos();
    }
    // Reset smile selection.
    if (acList !== this.props.acList) {
      this.setState({cur: 0}, this.scrollToSmile);
    }
  }
  private setAutocompletePos() {
    if (this.props.acList) {
      const el = this.props.textarea;
      let { left, top } = getCaretCoordinates(el, el.selectionEnd);
      left += 5;
      top -= 35;

      // TODO(Kagami): Workaround to shift autocomplete box against its
      // wrapper positioned element. Things to fix:
      //   * Fix full box shift
      //   * Put <SmileBox> as sibling of <textarea>
      //   * Remove overflow=hidden on .reply-content
      //     (fix multi file reply markup for that)
      const wrect = this.props.wrapper.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      left += rect.left - wrect.left;
      top += rect.top - wrect.top;

      this.setState({left, top});
    }
  }
  private scrollToSmile() {
    const l = this.listEl;
    // XXX(Kagami): Might be wrong if Preact adds some junk node.
    const s = l.children[this.state.cur] as HTMLElement;
    if (s.offsetLeft < l.scrollLeft
        || s.offsetLeft + s.offsetWidth > l.offsetWidth + l.scrollLeft) {
      l.scrollLeft = s.offsetLeft;
    }
  }
  private handleGlobalKey = (e: KeyboardEvent) => {
    if (e.keyCode === KEY_ESC) {
      this.props.onClose();
    } else if (e.target === this.props.textarea) {
      this.handleBodyKey(e);
    }
  }
  private handleGlobalClick = (e: MouseEvent) => {
    if (e.button === 0) {
      this.props.onClose();
    }
  }
  public handleBodyKey = (e: KeyboardEvent) => {
    const { acList } = this.props;
    const last = acList.length - 1;
    let { cur } = this.state;
    if (acList) {
      if (e.keyCode === KEY_LEFT) {
        e.preventDefault();
        cur -= 1;
        cur = cur < 0 ? last : cur;
        this.setState({cur}, this.scrollToSmile);
      } else if (e.keyCode === KEY_RIGHT) {
        e.preventDefault();
        cur += 1;
        cur = cur > last ? 0 : cur;
        this.setState({cur}, this.scrollToSmile);
      } else if (e.keyCode === KEY_ENTER) {
        e.preventDefault();
        this.props.onSelect(acList[cur]);
      } else if (
        e.keyCode === KEY_HOME
        || e.keyCode === KEY_END
        || e.keyCode === KEY_UP
        || e.keyCode === KEY_DOWN
        ) {
        // Prefer to close autocomplete box on common cursor movements
        // to not annoy the user in case of false-positives.
        this.props.onClose();
      }
    }
  }
  private handleIgnore = (e: MouseEvent) => {
    e.stopPropagation();
  }
  private handleSmileOver = (cur: number) => {
    this.setState({cur});
  }
  private handleSmileClick = (id: string) => {
    this.props.onSelect(id);
  }
  public render({ acList }: any, { left, top, cur }: any) {
    const style = acList ? { left, top } : null;
    cur = acList ? cur : -1;
    return (
      <div
        class={cx("smile-box", {
          "smile-box_full": !acList,
          "smile-box_autocomplete": !!acList,
        })}
        style={style}
        onMouseDown={this.handleIgnore}
        onMouseMove={this.handleIgnore}
        onClick={this.handleIgnore}
      >
        <div class="smiles" ref={setter(this, "listEl")}>
          {(acList || smileList).map((id: string, i: number) =>
            <div class={cx("smiles-item", {"smiles-item_cur": i === cur})}>
              <i
                class={cx("smile", `smile-${id}`, "smiles-icon")}
                title={`:${id}:`}
                onMouseOver={this.handleSmileOver.bind(null, i)}
                onClick={this.handleSmileClick.bind(null, id)}
              />
            </div>,
          )}
        </div>
      </div>
    );
  }
}
