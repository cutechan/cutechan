import * as cx from "classnames";
import { Component, h, render } from "preact";
import { showAlert } from "../alerts";
import API from "../api";
import { PostData } from "../common";
import { ln, printf } from "../lang";
import { boards, config, page, storeMine } from "../state";
import { duration, fileSize, renderBody } from "../templates";
import {
  AbortError, Dict, FutureAPI, getID, hook, HOOKS, on, Progress, scrollToTop,
  setter as s, ShowHide, unhook,
} from "../util";
import {
  HEADER_HEIGHT_PX,
  POST_BODY_SEL,
  POST_SEL,
  REPLY_BOARD_WIDTH_PX,
  REPLY_CONTAINER_SEL,
  REPLY_HEIGHT_PX,
  REPLY_MIN_HEIGHT_PX,
  REPLY_MIN_WIDTH_PX,
  REPLY_THREAD_WIDTH_PX,
  TRIGGER_OPEN_REPLY_SEL,
  TRIGGER_QUOTE_POST_SEL,
} from "../vars";
import * as signature from "./signature";

function quoteText(text: string): string {
  return text.trim().split(/\n/).filter((line) => {
    return line.length > 0;
  }).map((line) => {
    return ">" + line;
  }).join("\n") + "\n";
}

function getImageInfo(file: File, skipCopy: boolean): Promise<Dict> {
  return new Promise((resolve, reject) => {
    let url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      if (skipCopy) {
        resolve({ width, height, url });
        return;
      }
      const c = document.createElement("canvas");
      const ctx = c.getContext("2d");
      c.width = width;
      c.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      url = c.toDataURL();
      resolve({ width, height, url });
    };
    img.onerror = reject;
    img.src = url;
  });
}

function getVideoInfo(file: File): Promise<Dict> {
  return new Promise((resolve, reject) => {
    const vid = document.createElement("video");
    vid.muted = true;
    vid.onloadeddata = () => {
      const { videoWidth: width, videoHeight: height, duration: dur } = vid;
      if (!width || !height) {
        reject(new Error());
        return;
      }
      const c = document.createElement("canvas");
      const ctx = c.getContext("2d");
      c.width = width;
      c.height = height;
      ctx.drawImage(vid, 0, 0, width, height);
      const url = c.toDataURL();
      resolve({ width, height, dur, url });
    };
    vid.onerror = reject;
    vid.src = URL.createObjectURL(file);
  });
}

function getFileInfo(file: File): Promise<Dict> {
  let fn = null;
  let skipCopy = false;
  if (file.type.startsWith("video/")) {
    fn = getVideoInfo;
  } else {
    fn = getImageInfo;
    // TODO(Kagami): Dump first frame of APNG and animated WebP.
    if (file.type !== "image/gif") {
      skipCopy = true;
    }
  }
  return fn(file, skipCopy);
}

class FilePreview extends Component<any, any> {
  public render(props: any) {
    const { url } = props.info;
    return (
      <div class="reply-file">
        <a class="control reply-remove-file-control" onClick={this.handleRemove}>
          <i class="fa fa-remove" />
        </a>
        <img class="reply-file-thumb" src={url} />
        <div class="reply-file-info">{this.renderInfo()}</div>
      </div>
    );
  }
  private handleRemove = () => {
    this.props.onRemove();
  }
  private renderInfo(): string {
    const { size } = this.props.file;
    const { width, height, dur } = this.props.info;
    let out = `${width}×${height}, ${fileSize(size)}`;
    if (dur) {
      out += `, ${duration(Math.round(dur))}`;
    }
    return out;
  }
}

// tslint:disable-next-line:max-classes-per-file
class BodyPreview extends Component<any, any> {
  public shouldComponentUpdate({ body }: any) {
    return body !== this.props.body;
  }
  public render({ body }: any) {
    const post = {body} as PostData;
    const html = renderBody(post);
    return (
      <div
        class="reply-body reply-message"
        dangerouslySetInnerHTML={{__html: html}}
      />
    );
  }
}

// tslint:disable-next-line:max-classes-per-file
class Reply extends Component<any, any> {
  public state = {
    // tslint:disable:object-literal-sort-keys
    float: false,
    left: 0,
    top: 0,
    width: page.thread ? REPLY_THREAD_WIDTH_PX : REPLY_BOARD_WIDTH_PX,
    height: REPLY_HEIGHT_PX,
    pos: "i",
    editing: true,
    sending: false,
    progress: 0,
    board: page.board === "all" ? boards[0].id : page.board,
    thread: page.thread,
    subject: "",
    body: "",
    files: [] as Array<{file: File, info: Dict}>,
    // tslint:enable:object-literal-sort-keys
  };
  private mainEl: HTMLElement = null;
  private bodyEl: HTMLInputElement = null;
  private fileEl: HTMLInputElement = null;
  private sendAPI: FutureAPI = {};
  private moving = false;
  private resizing = false;
  private baseX = 0;
  private baseY = 0;
  private startX = 0;
  private startY = 0;
  private startW = 0;
  private startH = 0;
  public componentWillMount() {
    const { quoted } = this.props;
    if (quoted) {
      this.quote(quoted);
      this.setFloat(quoted);
    }
  }
  public componentDidMount() {
    hook(HOOKS.openReply, this.focus);
    hook(HOOKS.sendReply, this.handleSend);
    hook(HOOKS.selectFile, this.handleAttach);
    hook(HOOKS.previewPost, this.handleToggleEditing);
    document.addEventListener(
      "mousemove",
      this.handleGlobalMove,
      {passive: true},
    );
    document.addEventListener(
      "mouseup",
      this.handleGlobalUp,
      {passive: true},
    );
    this.focus();
    const caret = this.state.body.length;
    this.bodyEl.setSelectionRange(caret, caret);
  }
  public componentWillUnmount() {
    unhook(HOOKS.openReply, this.focus);
    unhook(HOOKS.sendReply, this.handleSend);
    unhook(HOOKS.selectFile, this.handleAttach);
    unhook(HOOKS.previewPost, this.handleToggleEditing);
    document.removeEventListener(
      "mousemove",
      this.handleGlobalMove,
      {passive: true},
    );
    document.removeEventListener(
      "mouseup",
      this.handleGlobalUp,
      {passive: true},
    );
  }
  public componentWillReceiveProps({ quoted }: any) {
    if (quoted !== this.props.quoted) {
      if (quoted) {
        this.quote(quoted);
      } else {
        this.handleFormPin();
      }
    }
  }
  public render({}, { float }: any) {
    return (
      <div
        class={cx("reply", {reply_float: float})}
        ref={s(this, "mainEl")}
        style={this.style}
        onMouseDown={this.handleFormDown}
        onMouseMove={this.handleFormMove}
      >

        {this.renderFiles()}

        <div class="reply-main">

          <div class="reply-content-wrapper">
            <div class="reply-content">
              {this.renderHeader()}
              {this.renderBody()}
            </div>
            {this.renderSideControls()}
          </div>

          {this.renderFooterControls()}

        </div>

        <input
          class="reply-files-input"
          ref={s(this, "fileEl")}
          type="file"
          accept="image/*,video/*"
          onChange={this.handleFileLoad}
        />

      </div>
    );
  }
  private get cursor() {
    switch (this.state.pos) {
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    default:
      return "inherit";
    }
  }
  private get style() {
    const { float, left, top, width, height } = this.state;
    const o = {width, height, cursor: this.cursor};
    if (float) {
      Object.assign(o, {position: "fixed", left, top});
    }
    return o;
  }
  private get invalid() {
    const { subject, body, files } = this.state;
    const hasSubject = !!subject || !!page.thread;
    return !hasSubject || (!body && !files.length);
  }
  private get disabled() {
    const { sending } = this.state;
    return sending || this.invalid;
  }
  private quote(e: MouseEvent) {
    const post = (e.target as Element).closest(POST_SEL);
    const postBody = post.querySelector(POST_BODY_SEL);
    const postID = getID(post);
    let { body } = this.state;
    let start = 0;
    let end = 0;
    if (this.bodyEl) {
      start = this.bodyEl.selectionStart;
      end = this.bodyEl.selectionEnd;
    }

    let cited = "";
    if (!body.includes(`>>${postID}`)) {
      cited += `>>${postID}\n`;
    }

    const sel = window.getSelection();
    if (!sel.isCollapsed
        && postBody.contains(sel.anchorNode)
        && postBody.contains(sel.focusNode)) {
      cited += quoteText(sel.toString());
    }

    const caret = start + cited.length;
    if (end < body.length) {
      cited += "\n";
    }
    body = body.slice(0, start) + cited + body.slice(end);
    this.setState({body}, () => {
      // Don't focus invisible element.
      if (this.bodyEl && this.bodyEl.offsetParent !== null) {
        this.focus();
        this.bodyEl.setSelectionRange(caret, caret);
      }
    });
  }
  private setFloat(e: MouseEvent) {
    const post = (e.target as Element).closest(POST_SEL);
    const rect = post.getBoundingClientRect();

    const margin = 10;
    const leftest = 0;
    const rightest = window.innerWidth - this.state.width - margin;
    const toppest = HEADER_HEIGHT_PX + margin;
    const bottomest = window.innerHeight - this.state.height - margin;
    const x = rect.right + margin;
    const y = rect.top;
    const left = Math.max(leftest, Math.min(x, rightest));
    const top = Math.max(toppest, Math.min(y, bottomest));

    this.setState({float: true, left, top});
  }
  private focus = () => {
    if (!this.bodyEl) return;
    this.bodyEl.focus();
    if (page.thread) {
      if (!this.state.float) {
        this.bodyEl.scrollIntoView();
      }
    } else {
      scrollToTop();
    }
  }
  private saveCoords(e: MouseEvent) {
    this.baseX = e.clientX;
    this.baseY = e.clientY;
    const rect = this.mainEl.getBoundingClientRect();
    this.startX = rect.left;
    this.startY = rect.top;
    this.startW = rect.width;
    this.startH = rect.height;
  }
  private handleMoveDown = (e: MouseEvent) => {
    e.preventDefault();
    this.moving = true;
    this.saveCoords(e);
  }
  private handleGlobalMove = (e: MouseEvent) => {
    if (this.moving) {
      this.setState({
        float: true,
        left: this.startX + e.clientX - this.baseX,
        top: this.startY + e.clientY - this.baseY,
      });
    } else if (this.resizing) {
      const { pos } = this.state;
      const dx = e.clientX - this.baseX;
      const dy = e.clientY - this.baseY;
      let { startW: width, startH: height, startX: left, startY: top } = this;
      switch (pos) {
      case "nw":
        left += dx;
        width -= dx;
        top += dy;
        height -= dy;
        break;
      case "se":
        width += dx;
        height += dy;
        break;
      case "ne":
        width += dx;
        top += dy;
        height -= dy;
        break;
      case "sw":
        left += dx;
        width -= dx;
        height += dy;
        break;
      case "n":
        top += dy;
        height -= dy;
        break;
      case "s":
        height += dy;
        break;
      case "e":
        width += dx;
        break;
      case "w":
        left += dx;
        width -= dx;
        break;
      }

      // Restore out-of-bound values.
      if (width < REPLY_MIN_WIDTH_PX
          && (pos === "nw" || pos === "sw" || pos === "w")) {
        left -= REPLY_MIN_WIDTH_PX - width;
      }
      if (height < REPLY_MIN_HEIGHT_PX
          && (pos === "nw" || pos === "ne" || pos === "n")) {
        top -= REPLY_MIN_HEIGHT_PX - height;
      }
      width = Math.max(width, REPLY_MIN_WIDTH_PX);
      height = Math.max(height, REPLY_MIN_HEIGHT_PX);

      this.setState({width, height, left, top});
    }
  }
  private handleGlobalUp = () => {
    this.moving = false;
    this.resizing = false;
  }
  private handleFormDown = (e: MouseEvent) => {
    if (this.state.pos === "i") return;
    e.preventDefault();
    this.resizing = true;
    this.saveCoords(e);
  }
  private handleFormMove = (e: MouseEvent) => {
    if (this.resizing) return;
    const rect = this.mainEl.getBoundingClientRect();
    const w = rect.width;
    // tslint:disable-next-line:no-shadowed-variable
    const h = rect.height;
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top;
    const b = 5;
    let pos = "i";
    if (ox <= b && oy <= b) {
      pos = "nw";
    } else if (ox <= b && oy >= h - b) {
      pos = "sw";
    } else if (ox >= w - b && oy <= b) {
      pos = "ne";
    } else if (ox >= w - b && oy >= h - b) {
      pos = "se";
    } else if (ox <= b) {
      pos = "w";
    } else if (oy <= b) {
      pos = "n";
    } else if (ox >= w - b) {
      pos = "e";
    } else if (oy >= h - b) {
      pos = "s";
    }
    this.setState({pos});
  }
  private handleFormPin = () => {
    this.setState({float: false}, this.focus);
  }
  private handleFormHide = () => {
    this.props.onHide();
  }
  private handleSubjectChange = (e: any) => {
    this.setState({subject: e.target.value});
  }
  private handleBoardChange = (e: any) => {
    this.setState({board: e.target.value});
  }
  private handleBodyChange = (e: any) => {
    this.setState({body: e.target.value});
  }
  private handleAttach = () => {
    this.fileEl.click();
  }
  private handleAttachRemove = () => {
    if (this.state.sending) return;
    this.setState({files: []}, this.focus);
  }
  private handleFileLoad = () => {
    const file = this.fileEl.files[0];
    // Allow to select same file again.
    this.fileEl.value = null;

    if (file.size > config.maxSize * 1024 * 1024) {
      showAlert(ln.UI.tooBig);
      return;
    }

    // Add file only if was able to grab info.
    getFileInfo(file).then((info: Dict) => {
      const files = [{file, info}];
      this.setState({files}, this.focus);
    }, () => {
      showAlert(ln.UI.unsupFile);
    });
  }
  private handleSend = () => {
    if (this.disabled) return;
    const { board, thread, subject, body } = this.state;
    const files = this.state.files.map((f) => f.file);
    const sendFn = page.thread ? API.post.create : API.thread.create;
    this.setState({sending: true});
    API.post.createToken().then(({ id: token }: Dict) => {
      const sign = signature.gen(token);
      return sendFn({
        // tslint:disable:object-literal-sort-keys
        board, thread,
        subject, body, files,
        token, sign,
        // tslint:enable:object-literal-sort-keys
      }, this.handleSendProgress, this.sendAPI);
    }).then((res: Dict) => {
      if (page.thread) {
        storeMine(res.id, page.thread);
        this.handleFormHide();
      } else {
        storeMine(res.id, res.id);
        location.href = `/${board}/${res.id}`;
      }
    }, (err: Error) => {
      if (err instanceof AbortError) return;
      showAlert({title: ln.UI.sendErr, message: err.message});
    }).then(() => {
      this.setState({sending: false, progress: 0});
      this.sendAPI = {};
    });
  }
  private handleSendProgress = (e: ProgressEvent) => {
    const progress = Math.floor(e.loaded / e.total * 100);
    this.setState({progress});
  }
  private handleSendAbort = () => {
    if (this.sendAPI.abort) {
      this.sendAPI.abort();
    }
  }
  private makeHandleFormat = (markup: string) => {
    return () => {
      const start = this.bodyEl.selectionStart;
      const end = this.bodyEl.selectionEnd;
      let { body } = this.state;
      if (start < end) {
        const sel = body.slice(start, end);
        body = body.slice(0, start) +
               markup + sel + markup +
               body.slice(end);
        this.setState({body}, this.focus);
      } else {
        const prevChar = (start > 0) ? body[start - 1] : "";
        const sep = (body && prevChar !== "\n") ? " " : "";
        body = body.slice(0, start) + sep + markup + markup + body.slice(end);
        const caret = start + sep.length + markup.length;
        this.setState({body}, () => {
          this.focus();
          this.bodyEl.setSelectionRange(caret, caret);
        });
      }
    };
  }
  private handleToggleEditing = () => {
    const editing = !this.state.editing;
    this.setState({editing}, this.focus);
  }
  private renderBoards() {
    if (page.board !== "all") return null;
    const { sending, board } = this.state;
    return (
      <select
        class="reply-board"
        value={board}
        disabled={sending}
        onInput={this.handleBoardChange}
      >
        {boards.map(({ id }) =>
        <option class="reply-board-item" key={id} value={id}>{id}</option>,
        )}
      </select>
    );
  }
  private renderFiles() {
    const { files } = this.state;
    return (
      <div class="reply-files">
        {files.map(({ file, info }) =>
          <FilePreview
            key={info.url}
            info={info}
            file={file}
            onRemove={this.handleAttachRemove}
          />,
        )}
      </div>
    );
  }
  private renderHeader() {
    if (page.thread) return null;
    const { sending, subject } = this.state;
    return (
      <div class="reply-header">
        {this.renderBoards()}
        <input
          class="reply-subject"
          placeholder={ln.UI.subject + "∗"}
          value={subject}
          disabled={sending}
          onInput={this.handleSubjectChange}
        />
      </div>
    );
  }
  private renderBody() {
    const { editing, sending, body } = this.state;
    return editing ? (
      <textarea
        class="reply-body"
        ref={s(this, "bodyEl")}
        value={body}
        disabled={sending}
        onInput={this.handleBodyChange}
      />
    ) : (
      <BodyPreview body={body} />
    );
  }
  private renderSideControls() {
    const { float, sending } = this.state;
    return (
      <div class="reply-controls reply-side-controls">
        <div class="reply-side-controls-inner">
          <ShowHide show={float}>
            <a
              class="control reply-side-control reply-pin-control"
              onClick={this.handleFormPin}
            >
              <i class="fa fa-thumb-tack" />
            </a>
          </ShowHide>
          <button
            class="control reply-side-control reply-hide-control"
            onClick={this.handleFormHide}
            disabled={sending}
          >
            <i class="fa fa-remove" />
          </button>
        </div>
        <div class="reply-dragger" onMouseDown={this.handleMoveDown} />
      </div>
    );
  }
  private renderFooterControls() {
    const { editing, sending, progress } = this.state;
    const sendTitle = sending ? `${progress}% (${ln.UI.clickToCancel})` : "";
    return (
      <div class="reply-controls reply-footer-controls">
        <button
          class="control reply-footer-control reply-attach-control"
          title={printf(ln.UI.attach, fileSize(config.maxSize * 1024 * 1024))}
          disabled={sending}
          onClick={this.handleAttach}
        >
          <i class="fa fa-file-image-o" />
        </button>

        <button
          class="control reply-footer-control reply-bold-control"
          title={ln.UI.bold}
          disabled={!editing || sending}
          onClick={this.makeHandleFormat("**")}
        >
          <i class="fa fa-bold" />
        </button>
        <button
          class="control reply-footer-control reply-italic-control"
          title={ln.UI.italic}
          disabled={!editing || sending}
          onClick={this.makeHandleFormat("*")}
        >
          <i class="fa fa-italic" />
        </button>
        <button
          class="control reply-footer-control reply-spoiler-control"
          title={ln.UI.spoiler}
          disabled={!editing || sending}
          onClick={this.makeHandleFormat("%%")}
        >
          <i class="fa fa-eye-slash" />
        </button>
        <button
          class="control reply-footer-control reply-edit-control"
          title={ln.Forms.previewPost[0]}
          disabled={sending}
          onClick={this.handleToggleEditing}
        >
          <i class={cx("fa", editing ? "fa-print" : "fa-pencil")} />
        </button>

        <div class="reply-dragger" onMouseDown={this.handleMoveDown} />
        <ShowHide show={!this.invalid}>
          <Progress
            className="button reply-send-button"
            progress={progress}
            title={sendTitle}
            onClick={sending ? this.handleSendAbort : this.handleSend}
          >
            {sending ? "" : ln.UI.submit}
          </Progress>
        </ShowHide>
      </div>
    );
  }
}

// tslint:disable-next-line:max-classes-per-file
class ReplyContainer extends Component<any, any> {
  public state = {
    quoted: null as Element,
    show: false,
  };
  public componentDidMount() {
    hook(HOOKS.openReply, () => {
      this.setState({show: true});
    });
    hook(HOOKS.closeReply, this.handleHide);
    on(document, "click", () => {
      this.setState({show: true});
    }, {selector: TRIGGER_OPEN_REPLY_SEL});
    on(document, "click", (e) => {
      this.setState({show: true, quoted: e});
    }, {selector: TRIGGER_QUOTE_POST_SEL});
  }
  public render({}, { show, quoted }: any) {
    return (
      <ShowHide show={show}>
        <Reply quoted={quoted} onHide={this.handleHide} />
      </ShowHide>
    );
  }
  private handleHide = () => {
    this.setState({show: false, quoted: null});
  }
}

export function init() {
  const container = document.querySelector(REPLY_CONTAINER_SEL);
  if (container) {
    render(<ReplyContainer/>, container);
  }
}
