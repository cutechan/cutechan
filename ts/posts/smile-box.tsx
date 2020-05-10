/**
 * Smile box widget with autocomplete feature.
 */

import * as cx from "classnames";
import { Component, h } from "preact";
import * as getCaretCoordinates from "textarea-caret";
import smiles from "../../smiles-pp/smiles";
import { reverse, rotateRecent, setter } from "../util";

const smileList = Array.from(smiles).sort();
const thingSmiles = new Set(
  `
  heart heart2 heart3 heart4 cigarette soju wine coffee
  cola chips goose nogoose gun gun2 karandash knife
  ovsyanka ramyun
`
    .trim()
    .split(/\s+/)
);
const memeSmiles = new Set(
  `
  beast cool frukt heechul hyunsuk jyp jyp2 kwangsoo lookup priunil sooman
  tellmemore v_gugudalnik sekshie plsno orly police autism hyperlol iljin
  blinchick hug shy
`
    .trim()
    .split(/\s+/)
);

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

function isThingSmile(id: string): boolean {
  return thingSmiles.has(id);
}

function isMemeSmile(id: string): boolean {
  return memeSmiles.has(id);
}

function isIdolSmile(id: string): boolean {
  return !isThingSmile(id) && !isMemeSmile(id);
}

// Recent smiles list routines.

const MAX_RECENT = 16;
let recent = [] as string[];

function loadRecent() {
  try {
    recent = JSON.parse(localStorage.recentSmiles);
  } catch (e) {
    /* skip */
  }
}

function storeRecent(id: string) {
  recent = rotateRecent(recent, id, MAX_RECENT);
  localStorage.recentSmiles = JSON.stringify(recent);
}

window.addEventListener("storage", loadRecent);
loadRecent();

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
  const nextCh = pos < len ? body.charCodeAt(pos) : 0;
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
  const prevCh = i > 0 ? body.charCodeAt(i - 1) : 0;
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
      this.setState({ cur: 0 }, this.scrollToSmile);
    }
  }
  private setAutocompletePos() {
    if (this.props.acList) {
      const el = this.props.textarea;

      // Get caret offset relative to closest positioned element.
      let { left, top } = getCaretCoordinates(el, el.selectionEnd);

      // Adjust for scrolling.
      top -= el.scrollTop;

      // Slightly fix box position.
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

      this.setState({ left, top });
    }
  }
  private scrollToSmile() {
    const l = this.listEl;
    // XXX(Kagami): Might be wrong if Preact adds some junk node.
    const s = l.children[this.state.cur] as HTMLElement;
    if (
      s.offsetLeft < l.scrollLeft ||
      s.offsetLeft + s.offsetWidth > l.offsetWidth + l.scrollLeft
    ) {
      l.scrollLeft = s.offsetLeft;
    }
  }
  private handleGlobalKey = (e: KeyboardEvent) => {
    if (e.keyCode === KEY_ESC) {
      this.props.onClose();
    } else if (e.target === this.props.textarea) {
      this.handleBodyKey(e);
    }
  };
  private handleGlobalClick = (e: MouseEvent) => {
    if (e.button === 0) {
      this.props.onClose();
    }
  };
  private handleBodyKey = (e: KeyboardEvent) => {
    const { acList } = this.props;
    if (!acList) return;
    const last = acList.length - 1;
    let { cur } = this.state;
    if (e.keyCode === KEY_LEFT) {
      e.preventDefault();
      cur -= 1;
      cur = cur < 0 ? last : cur;
      this.setState({ cur }, this.scrollToSmile);
    } else if (e.keyCode === KEY_RIGHT) {
      e.preventDefault();
      cur += 1;
      cur = cur > last ? 0 : cur;
      this.setState({ cur }, this.scrollToSmile);
    } else if (e.keyCode === KEY_ENTER) {
      e.preventDefault();
      this.handleSmileSelect(acList[cur]);
    } else if (
      e.keyCode === KEY_HOME ||
      e.keyCode === KEY_END ||
      e.keyCode === KEY_UP ||
      e.keyCode === KEY_DOWN
    ) {
      // Prefer to close autocomplete box on common cursor movements
      // to not annoy the user in case of false-positives.
      this.props.onClose();
    }
  };
  private handleIgnore = (e: MouseEvent) => {
    e.stopPropagation();
  };
  private handleSmileOver = (cur: number) => {
    this.setState({ cur });
  };
  private handleSmileSelect = (id: string) => {
    storeRecent(id);
    this.props.onSelect(id);
  };
  // tslint:disable-next-line:member-ordering
  public render({ acList }: any, { left, top }: any) {
    const style = acList ? { left, top } : null;
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
          {!acList && recent.length ? this.renderRecent() : null}
          {acList ? this.renderList(acList) : this.renderAll()}
        </div>
      </div>
    );
  }
  private renderRecent() {
    return [
      <div class="smiles-group">{this.renderList(recent)}</div>,
      <hr class="smiles-separator" />,
    ];
  }
  private renderAll() {
    return [
      <div class="smiles-group">
        {this.renderList(smileList.filter(isThingSmile))}
      </div>,
      <hr class="smiles-separator" />,
      <div class="smiles-group">
        {this.renderList(smileList.filter(isMemeSmile))}
      </div>,
      <hr class="smiles-separator" />,
      <div class="smiles-group">
        {this.renderList(smileList.filter(isIdolSmile))}
      </div>,
    ];
  }
  private renderList(list: string[]) {
    const cur = this.props.acList ? this.state.cur : -1;
    return list.map((id: string, i: number) => (
      <div class={cx("smiles-item", { "smiles-item_cur": i === cur })}>
        <i
          class={cx("smile", `smile-${id}`, "smiles-icon")}
          title={`:${id}:`}
          onMouseOver={this.handleSmileOver.bind(null, i)}
          onClick={this.handleSmileSelect.bind(null, id)}
        />
      </div>
    ));
  }
}
