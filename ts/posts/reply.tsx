import * as cx from "classnames";
import { Component, h, render } from "preact";
import { showAlert } from "../alerts";
import API from "../api";
import { PostData } from "../common";
import { ln, printf } from "../lang";
import { isStaff } from "../mod";
import { boards, config, page, storeMine } from "../state";
import { duration, fileSize, renderBody } from "../templates";
import {
  AbortError, collect, Dict, FutureAPI, getID, hook, HOOKS, on, Progress,
  scrollToTop, setter as s, ShowHide, unhook,
} from "../util";
import {
  HEADER_HEIGHT_PX,
  POST_BODY_SEL,
  POST_SEL,
  REPLY_BOARD_WIDTH_PX,
  REPLY_CONTAINER_SEL,
  REPLY_HEIGHT_PX,
  REPLY_THREAD_WIDTH_PX,
  TRIGGER_OPEN_REPLY_SEL,
  TRIGGER_QUOTE_POST_SEL,
} from "../vars";
import * as signature from "./signature";
import SmileBox, { autocomplete } from "./smile-box";

function quoteText(text: string): string {
  return text
    .trim()
    .split(/\n/)
    .filter((line) => !!line)
    .map((line) => ">" + line)
    .join("\n");
}

function getImageInfo(file: File, skipCopy: boolean): Promise<Dict> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    let thumb = src;
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      if (skipCopy) {
        resolve({ width, height, src, thumb });
        return;
      }
      const c = document.createElement("canvas");
      const ctx = c.getContext("2d");
      c.width = width;
      c.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      thumb = c.toDataURL();
      resolve({ width, height, src, thumb });
    };
    img.onerror = reject;
    img.src = src;
  });
}

function getVideoInfo(file: File): Promise<Dict> {
  return new Promise((resolve, reject) => {
    const vid = document.createElement("video");
    const src = URL.createObjectURL(file);
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
      const thumb = c.toDataURL();
      resolve({ width, height, dur, src, thumb });
    };
    vid.onerror = reject;
    vid.src = src;
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

// Event helpers.
function getClientX(e: MouseEvent | TouchEvent): number {
  return (e as any).touches ? (e as any).touches[0].clientX : (e as any).clientX;
}
function getClientY(e: MouseEvent | TouchEvent): number {
  return (e as any).touches ? (e as any).touches[0].clientY : (e as any).clientY;
}

class FilePreview extends Component<any, any> {
  public render(props: any) {
    const { thumb } = props.info;
    const infoText = this.renderInfo();
    return (
      <div class="reply-file">
        <a class="control reply-remove-file-control" onClick={props.onRemove}>
          <i class="fa fa-remove" />
        </a>
        <img class="reply-file-thumb" src={thumb} />
        <div class="reply-file-info" title={infoText}>{infoText}</div>
      </div>
    );
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

class Reply extends Component<any, any> {
  public state = {
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
    smileBox: false,
    smileBoxAC: null as string[],
    fwraps: [] as Array<{file: File, info: Dict}>,
    staffTitle: false,
  };
  private mainEl: HTMLElement = null;
  private bodyEl: HTMLTextAreaElement = null;
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
    const { quoted, dropped } = this.props;
    if (quoted) {
      this.quote(quoted);
      this.setFloat(quoted);
    }
    if (dropped) {
      this.handleDrop(dropped);
    }
  }
  public componentDidMount() {
    hook(HOOKS.openReply, this.focus);
    hook(HOOKS.sendReply, this.handleSend);
    hook(HOOKS.selectFile, this.handleAttach);
    hook(HOOKS.previewPost, this.handleToggleEditing);
    hook(HOOKS.boldMarkup, this.pasteBold);
    hook(HOOKS.italicMarkup, this.pasteItalic);
    hook(HOOKS.spoilerMarkup, this.pasteSpoiler);
    document.addEventListener("mousemove", this.handleGlobalMove);
    document.addEventListener("touchmove", this.handleGlobalMove);
    document.addEventListener("mouseup", this.handleGlobalUp);
    document.addEventListener("touchend", this.handleGlobalUp);
    this.focus();
    const caret = this.state.body.length;
    this.bodyEl.setSelectionRange(caret, caret);
  }
  public componentWillUnmount() {
    unhook(HOOKS.openReply, this.focus);
    unhook(HOOKS.sendReply, this.handleSend);
    unhook(HOOKS.selectFile, this.handleAttach);
    unhook(HOOKS.previewPost, this.handleToggleEditing);
    unhook(HOOKS.boldMarkup, this.pasteBold);
    unhook(HOOKS.italicMarkup, this.pasteItalic);
    unhook(HOOKS.spoilerMarkup, this.pasteSpoiler);
    document.removeEventListener("mousemove", this.handleGlobalMove);
    document.removeEventListener("touchmove", this.handleGlobalMove);
    document.removeEventListener("mouseup", this.handleGlobalUp);
    document.removeEventListener("touchend", this.handleGlobalUp);
  }
  public componentWillReceiveProps({ quoted, dropped }: any) {
    if (quoted !== this.props.quoted) {
      if (quoted) {
        this.quote(quoted);
      } else {
        this.handleFormPin();
      }
    }
    if (dropped !== this.props.dropped) {
      if (dropped) {
        this.handleDrop(dropped);
      }
    }
  }
  public render({}, { float, fwraps, staffTitle }: any) {
    const manyf = fwraps.length > 1;
    return (
      <div
        ref={s(this, "mainEl")}
        class={cx("reply", {
          reply_float: float,
          reply_files: manyf,
          reply_mod: staffTitle,
        })}
        style={this.style}
        onMouseDown={this.handleFormDown}
        onMouseMove={this.handleFormMove}
      >

        <div class="reply-inner">

          <div class="reply-content">
            {this.renderFiles()}
            <div class="reply-content-inner">
              {this.renderHeader()}
              {this.renderBody()}
            </div>
          </div>

          {this.renderSideControls()}

        </div>

        {this.renderFooterControls()}
        {this.renderSmileBox()}

        <input
          class="reply-files-input"
          ref={s(this, "fileEl")}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={this.handleFileChange}
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
  private get minWidth() {
    return 400;
  }
  private get minHeight() {
    const manyf = this.state.fwraps.length > 1;
    return manyf ? 300 : 200;
  }
  private get style() {
    const { float, left, top, width } = this.state;
    // Recalc because it depends on state.
    const height = Math.max(this.minHeight, this.state.height);
    const o = {width, height, cursor: this.cursor} as Dict;
    if (float) {
      o.position = "fixed";
      o.left = left;
      o.top = top;
    }
    return o;
  }
  private get invalid() {
    const { subject, body, fwraps } = this.state;
    const hasSubject = !!subject || !!page.thread;
    return !hasSubject || (!body && !fwraps.length);
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
    const prevCh = (start > 0) ? body[start - 1] : "";
    const prevNL = !prevCh || prevCh === "\n";
    const nextCh = (end < body.length) ? body[end] : "";
    const hasID = body.includes(">>" + postID);
    const sel = window.getSelection();
    const text = quoteText(sel.toString());
    const hasText = !sel.isCollapsed
        && postBody.contains(sel.anchorNode)
        && postBody.contains(sel.focusNode)
        && !!text;

    if (hasText && !prevNL) {
      cited += "\n";
    }
    if (!hasText && !prevNL && prevCh !== " ") {
      cited += " ";
    }
    if (!hasText || !hasID) {
      cited += `>>${postID}`;
    }
    if (hasText && !hasID) {
      cited += "\n";
    }
    if (hasText) {
      cited += text;
    }
    if (hasText || prevNL) {
      cited += "\n";
    }

    const caret = start + cited.length;
    if (end < body.length) {
      if (hasText || prevNL) {
        if (nextCh !== "\n") {
          cited += "\n";
        }
      } else {
        if (nextCh !== " ") {
          cited += " ";
        }
      }
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
  private saveCoords(e: MouseEvent | TouchEvent) {
    this.baseX = getClientX(e);
    this.baseY = getClientY(e);
    const rect = this.mainEl.getBoundingClientRect();
    this.startX = rect.left;
    this.startY = rect.top;
    this.startW = rect.width;
    this.startH = rect.height;
  }
  private pasteMarkup(markup: string, opts?: Dict) {
    const { mono, nosep, offset } = opts || {} as Dict;
    const start = this.bodyEl.selectionStart - (offset || 0);
    const end = this.bodyEl.selectionEnd;
    let { body } = this.state;
    if (start < end && !mono) {
      const sel = body.slice(start, end);
      body = body.slice(0, start) +
             markup + sel + markup +
             body.slice(end);
      this.setState({body}, this.focus);
    } else {
      const prevCh = (start > 0) ? body[start - 1] : "";
      const sep = (!prevCh || prevCh === "\n" || prevCh === " " || nosep) ? "" : " ";
      const sndMarkup = mono ? "" : markup;
      body = body.slice(0, start) + sep + markup + sndMarkup + body.slice(end);
      const caret = start + sep.length + markup.length;
      this.setState({body}, () => {
        this.focus();
        this.bodyEl.setSelectionRange(caret, caret);
      });
    }
  }
  private pasteBold = () => this.pasteMarkup("**");
  private pasteItalic = () => this.pasteMarkup("*");
  private pasteSpoiler = () => this.pasteMarkup("%%");

  private handleGlobalMove = (e: MouseEvent | TouchEvent) => {
    if (this.moving) {
      this.setState({
        float: true,
        left: this.startX + getClientX(e) - this.baseX,
        top: this.startY + getClientY(e) - this.baseY,
      });
    } else if (this.resizing) {
      const { pos } = this.state;
      const dx = getClientX(e) - this.baseX;
      const dy = getClientY(e) - this.baseY;
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
      if (width < this.minWidth
          && (pos === "nw" || pos === "sw" || pos === "w")) {
        left -= this.minWidth - width;
      }
      if (height < this.minHeight
          && (pos === "nw" || pos === "ne" || pos === "n")) {
        top -= this.minHeight - height;
      }
      width = Math.max(width, this.minWidth);
      height = Math.max(height, this.minHeight);

      this.setState({width, height, left, top});
    }
  }
  private handleGlobalUp = () => {
    this.moving = false;
    this.resizing = false;
  }

  private handleMoveDown = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    this.moving = true;
    this.saveCoords(e);
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
    const smileBoxAC = autocomplete(this.bodyEl);
    const smileBox = !!smileBoxAC;
    this.setState({body: e.target.value, smileBox, smileBoxAC});
  }
  private handleAttach = () => {
    this.fileEl.click();
  }
  private handleAttachRemove = (src: string) => {
    if (this.state.sending) return;
    const fwraps = this.state.fwraps.filter((f) => f.info.src !== src);
    this.setState({fwraps}, this.focus);
  }
  private handleDrop = (files: FileList) => {
    if (files.length) {
      this.handleFiles(files);
    }
  }
  private handleFileChange = () => {
    const files = this.fileEl.files;
    if (files.length) {
      this.handleFiles(files);
    }
    this.fileEl.value = null;  // Allow to select same file again
  }
  private handleFiles = (files: FileList) => {
    // Limit number of selected files.
    const fslice = Array.prototype.slice.call(files, 0, config.maxFiles);
    collect(fslice.map(this.handleFile)).then((fwraps) => {
      fwraps = this.state.fwraps.concat(fwraps);
      // Skip elder attachments.
      fwraps = fwraps.slice(Math.max(0, fwraps.length - config.maxFiles));
      this.setState({fwraps}, this.focus);
    });
  }
  private handleFile = (file: File) => {
    if (file.size > config.maxSize * 1024 * 1024) {
      showAlert(ln.UI.tooBig);
      return Promise.reject(new Error(ln.UI.tooBig));
    }
    return getFileInfo(file).then((info: Dict) => {
      return {file, info};
    }, (err) => {
      showAlert(ln.UI.unsupFile);
      throw err;
    });
  }
  private handleSend = () => {
    if (this.disabled) return;
    const { board, thread, subject, body, staffTitle } = this.state;
    const files = this.state.fwraps.map((f) => f.file);
    const sendFn = page.thread ? API.post.create : API.thread.create;
    this.setState({sending: true});
    API.post.createToken().then(({ id: token }: Dict) => {
      const sign = signature.gen(token);
      return sendFn({
        board, thread,
        subject, body, files, staffTitle,
        token, sign,
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
  private handleToggleEditing = () => {
    const editing = !this.state.editing;
    this.setState({editing, smileBox: false}, this.focus);
  }
  private handleToggleStaffTitle = () => {
    const staffTitle = !this.state.staffTitle;
    this.setState({staffTitle}, this.focus);
  }
  private handleToggleSmileBox = (e: MouseEvent) => {
    // Needed because of https://github.com/developit/preact/issues/838
    e.stopPropagation();
    const smileBox = !!this.state.smileBoxAC || !this.state.smileBox;
    this.setState({smileBox, smileBoxAC: null});
  }
  private handleHideSmileBox = () => {
    this.setState({smileBox: false});
  }
  private handleSmileSelect = (id: string) => {
    this.setState({smileBox: false});

    // Remove already typed smile chunk.
    const ac = !!this.state.smileBoxAC;
    let offset = 0;
    if (ac) {
      let i = this.bodyEl.selectionEnd - 1;
      while (i >= 0 && this.state.body[i] !== ":") {
        i--;
        offset++;
      }
      offset++;
    }

    this.pasteMarkup(`:${id}:`, {mono: true, nosep: ac, offset});
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
    const { fwraps } = this.state;
    return (
      <div class="reply-files">
        {fwraps.map(({ file, info }) =>
          <FilePreview
            key={info.src}
            info={info}
            file={file}
            onRemove={this.handleAttachRemove.bind(null, info.src)}
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
        <div
          class="reply-dragger"
          onMouseDown={this.handleMoveDown}
          onTouchStart={this.handleMoveDown}
        />
      </div>
    );
  }
  private renderFooterControls() {
    const { editing, sending, progress, staffTitle } = this.state;
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
          title={ln.Forms.bold[0]}
          disabled={!editing || sending}
          onClick={this.pasteBold}
        >
          <i class="fa fa-bold" />
        </button>
        <button
          class="control reply-footer-control reply-italic-control"
          title={ln.Forms.italic[0]}
          disabled={!editing || sending}
          onClick={this.pasteItalic}
        >
          <i class="fa fa-italic" />
        </button>
        <button
          class="control reply-footer-control reply-spoiler-control"
          title={ln.Forms.spoiler[0]}
          disabled={!editing || sending}
          onClick={this.pasteSpoiler}
        >
          <i class="fa fa-eye-slash" />
        </button>
        <button
          class="control reply-footer-control reply-smile-control"
          title={ln.Forms.smile[0]}
          disabled={!editing || sending}
          onClick={this.handleToggleSmileBox}
        >
          <i class="reply-smile-icon" />
        </button>
        <button
          class="control reply-footer-control reply-edit-control"
          title={ln.Forms.previewPost[0]}
          disabled={sending}
          onClick={this.handleToggleEditing}
        >
          <i class={cx("fa", editing ? "fa-print" : "fa-pencil")} />
        </button>
        <ShowHide show={isStaff()}>
          <button
            class={cx("control", "reply-footer-control", "reply-badge-control",
                      {control_active: staffTitle})}
            title={ln.Forms.modBadge[0]}
            disabled={sending}
            onClick={this.handleToggleStaffTitle}
          >
            <i class="fa fa-id-badge" />
          </button>
        </ShowHide>

        <div
          class="reply-dragger"
          onMouseDown={this.handleMoveDown}
          onTouchStart={this.handleMoveDown}
        />
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
  private renderSmileBox() {
    const { body, smileBox, smileBoxAC } = this.state;
    if (!smileBox) return null;
    return (
      <SmileBox
        body={body}
        acList={smileBoxAC}
        wrapper={this.mainEl}
        textarea={this.bodyEl}
        onSelect={this.handleSmileSelect}
        onClose={this.handleHideSmileBox}
      />
    );
  }
}

class ReplyContainer extends Component<any, any> {
  public state = {
    show: false,
    quoted: null as Element,
    dropped: null as FileList,
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

    on(document, "dragover", (e) => {
      e.preventDefault();
    });
    on(document, "drop", (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length) {
        this.setState({show: true, dropped: files});
      }
    });
  }
  public render({}, { show, quoted, dropped }: any) {
    return (
      <ShowHide show={show}>
        <Reply quoted={quoted} dropped={dropped} onHide={this.handleHide} />
      </ShowHide>
    );
  }
  private handleHide = () => {
    this.setState({show: false, quoted: null, dropped: null});
  }
}

export function init() {
  const container = document.querySelector(REPLY_CONTAINER_SEL);
  if (container) {
    render(<ReplyContainer/>, container);
  }
}
