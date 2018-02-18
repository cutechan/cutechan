/**
 * Expand media attachments to the middle of the screen.
 */

import * as cx from "classnames";
import { Component, h, render } from "preact";
import options from "../options";
import { getModel } from "../state";
import { HOOKS, on, setter as s, trigger } from "../util";
import {
  POPUP_CONTAINER_SEL,
  POST_EMBED_SEL,
  POST_FILE_THUMB_SEL,
  TRIGGER_MEDIA_POPUP_SEL,
  ZOOM_STEP_PX,
} from "../vars";

const opened: Set<string> = new Set();

export function isOpen(url: string): boolean {
  return opened.has(url);
}

export function getCenteredRect({ width, height }: any) {
  const aspect = width / height;
  const pW = document.body.clientWidth;
  const pH = window.innerHeight;
  width = Math.min(width, pW);
  height = Math.ceil(width / aspect);
  if (height > pH) {
    height = pH;
    width = Math.ceil(height * aspect);
  }
  const left = (pW - width) / 2;
  const top = (pH - height) / 2;
  return {width, height, left, top};
}

interface PopupProps {
  video: boolean;
  audio: boolean;
  record: boolean;
  embed: boolean;
  transparent: boolean;
  url: string;
  html: string;
  width: number;
  height: number;
  duration: number;
  onClose: () => void;
}

interface PopupState {
  left: number;
  top: number;
  width: number;
  height: number;
  moving: boolean;
  resizing: boolean;
}

class Popup extends Component<PopupProps, PopupState> {
  private itemEl = null as HTMLVideoElement;
  private frameUrl = "";
  private aspect = 0;
  private baseX = 0;
  private baseY = 0;
  private startX = 0;
  private startY = 0;
  private startW = 0;
  private startH = 0;

  constructor(props: PopupProps) {
    super(props);

    const { width, height } = props;
    const rect = getCenteredRect({width, height});
    this.aspect = width / height;

    if (props.embed) {
      this.frameUrl = props.html.match(/src="(.*)"/)[1];
    }

    this.state = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      moving: false,
      resizing: false,
    };

  }
  public componentDidMount() {
    opened.add(this.props.url);
    trigger(HOOKS.openPostPopup);
    document.addEventListener("keydown", this.handleGlobalKey);
    document.addEventListener("mousemove", this.handleGlobalMove);
    document.addEventListener("click", this.handleGlobalClick);
    if (this.props.video || this.props.record) {
      this.itemEl.volume = options.volume;
      this.itemEl.src = this.props.url;
    }
  }
  public componentWillUnmount() {
    opened.delete(this.props.url);
    document.removeEventListener("keydown", this.handleGlobalKey);
    document.removeEventListener("mousemove", this.handleGlobalMove);
    document.removeEventListener("click", this.handleGlobalClick);
  }

  public render({ video, record, embed }: PopupProps, { left, top }: PopupState) {
    let cls = "";
    let fn = null;
    if (video) {
      cls = "popup_video";
      fn = this.renderVideo;
    } else if (record) {
      cls = "popup_record";
      fn = this.renderRecord;
    } else if (embed) {
      cls = "popup_embed";
      fn = this.renderEmbed;
    } else {
      cls = "popup_image";
      fn = this.renderImage;
    }
    return (
      <div class={cx("popup", cls)} style={{left, top}}>
        {fn.call(this)}
        {embed ? this.renderControls() : null}
      </div>
    );
  }
  private renderVideo() {
    const { width } = this.state;
    return (
      <div class="popup-video">
        <video
          class="popup-item popup-video-item"
          ref={s(this, "itemEl")}
          style={{width}}
          loop
          autoPlay
          controls={this.needVideoControls()}
          onVolumeChange={this.handleMediaVolume}
        />
        <div
          class={cx(
            "popup-video-overlay",
            {"popup-video-overlay_full": !this.needVideoControls()},
          )}
          onMouseDown={this.handleMediaDown}
          onWheel={this.handleMediaWheel}
        />
      </div>
    );
  }
  private renderImage() {
    const { url } = this.props;
    const { width } = this.state;
    // https://github.com/developit/preact/issues/663
    return (
      <img
        class="popup-item"
        ref={s(this, "itemEl")}
        style={{width}}
        src={url}
        draggable={0 as any}
        onDragStart={this.handleMediaDrag}
        onMouseDown={this.handleMediaDown}
        onWheel={this.handleMediaWheel}
      />
    );
  }
  private renderRecord() {
    return (
      <div class="popup-record" onMouseDown={this.handleMediaDown}>
        <i class="popup-record-icon fa fa-music" />
        <audio
          class="popup-item popup-record-item"
          ref={s(this, "itemEl")}
          autoPlay
          controls
          onVolumeChange={this.handleMediaVolume}
        />
      </div>
    );
  }
  private renderEmbed() {
    const { width, height, moving, resizing } = this.state;
    const pointerEvents = (moving || resizing) ? "none" : "auto";
    return (
      <iframe
        class="popup-item"
        ref={s(this, "itemEl")}
        style={{width, height, pointerEvents}}
        allowFullScreen
        frameBorder={0}
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-popups"
        src={this.frameUrl}
      />
    );
  }
  private renderControls() {
    return (
      <div class="popup-controls" onClick={this.handleControlsClick}>
        <a
          class="control popup-control popup-resize-control"
          onMouseDown={this.handleResizerDown}
        >
          <i class="fa fa-expand fa-flip-horizontal" />
        </a>
        <a
          class="control popup-control popup-move-control"
          onMouseDown={this.handleMediaDown}
        >
          <i class="fa fa-arrows" />
        </a>
        <a
          class="control popup-control popup-close-control"
          onClick={this.props.onClose}
        >
          <i class="fa fa-remove" />
        </a>
      </div>
    );
  }

  private needVideoControls() {
    return (
      this.props.video
      && !this.props.transparent
      && (this.props.audio || this.props.duration > 10)
    );
  }
  private handleGlobalKey = (e: KeyboardEvent) => {
    if (e.keyCode === 27) {
      this.props.onClose();
    }
  }
  private handleMediaDrag = (e: DragEvent) => {
    // NOTE(Kagami): Note that both draggable AND ondragstart are
    // required:
    // * without draggable Chrome doesn't produce click event after
    //   "mousedown" -> "mousemove" -> "mouseup" for image
    // * draggable attr doesn't seem to be working in Firefox so
    //   dragstart handler required
    e.preventDefault();
  }
  private handleMediaVolume = () => {
    options.volume = this.itemEl.volume;
  }
  private handleMediaDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    this.setState({moving: true});
    this.baseX = e.clientX;
    this.baseY = e.clientY;
    this.startX = this.state.left;
    this.startY = this.state.top;
  }
  private handleResizerDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    this.setState({resizing: true});
    this.baseX = e.clientX;
    this.baseY = e.clientY;
    this.startX = this.state.left;
    this.startY = this.state.top;
    this.startW = this.state.width;
    this.startH = this.state.height;
  }
  private handleGlobalMove = (e: MouseEvent) => {
    if (this.state.moving) {
      this.setState({
        left: this.startX + e.clientX - this.baseX,
        top: this.startY + e.clientY - this.baseY,
      });
    } else if (this.state.resizing) {
      const dx = e.clientX - this.baseX;
      const dy = e.clientY - this.baseY;
      let left = this.startX + dx;
      let top = this.startY + dy;
      let width = this.startW - dx;
      let height = this.startH - dy;

      const limit = 200;
      if (width < limit) {
        left -= limit - width;
      }
      if (height < limit) {
        top -= limit - height;
      }
      width = Math.max(width, limit);
      height = Math.max(height, limit);

      this.setState({left, top, width, height});
    }
  }
  private handleControlsClick = (e: MouseEvent) => {
    e.stopPropagation();
    this.setState({moving: false, resizing: false});
  }
  private handleGlobalClick = (e: MouseEvent) => {
    if (e.button === 0) {
      if (this.state.moving) {
        if (e.clientX === this.baseX && e.clientY === this.baseY) {
          this.props.onClose();
        }
      } else if (this.state.resizing) {
        /* skip */
      } else {
        if (options.popupBackdrop) {
          this.props.onClose();
        }
      }
    }
    this.setState({moving: false, resizing: false});
  }
  private handleMediaWheel = (e: WheelEvent) => {
    e.preventDefault();
    const order = e.deltaY < 0 ? 1 : -1;
    let { left, top, width, height } = this.state;
    if (width <= 50 && order < 0) return;
    left = left - (ZOOM_STEP_PX / 2) * order;
    top = top - (ZOOM_STEP_PX / this.aspect / 2) * order;
    width = Math.max(50, width + ZOOM_STEP_PX * order);
    height = Math.ceil(width / this.aspect);
    this.setState({left, top, width, height});
  }
}

interface PopupsState {
  popups: PopupProps[];
}

class Popups extends Component<any, PopupsState> {
  public state = {
    popups: [] as PopupProps[],
  };
  public componentDidMount() {
    on(document, "click", this.open, {
      selector: TRIGGER_MEDIA_POPUP_SEL,
    });
  }
  public render({}, { popups }: PopupsState) {
    return (
      <div class="popup-container-inner">
        {popups.map((props) =>
          <Popup
            {...props}
            key={props.url}
            onClose={this.makeHandleClose(props.url)}
          />,
        )}
      </div>
    );
  }
  private open = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.matches) return;
    if (e.button !== 0) return;
    e.preventDefault();

    const props = {
      video: false,
      audio: false,
      record: false,
      embed: false,
      transparent: false,
      url: "",
      html: "",
      width: 0,
      height: 0,
      duration: 0,
    } as PopupProps;

    if (target.matches(POST_FILE_THUMB_SEL)) {
      const post = getModel(target);
      const file = post.getFileByHash((target as HTMLImageElement).dataset.sha1);
      Object.assign(props, {
        video: file.video,
        audio: file.audio,
        record: file.audio && !file.video,
        transparent: file.transparent,
        url: file.src,
        width: file.dims[0] || 200,
        height: file.dims[1] || 200,
        duration: file.length,
      });
    } else if (target.matches(POST_EMBED_SEL)) {
      Object.assign(props, {
        embed: true,
        url: (target as HTMLLinkElement).href,
        html: target.dataset.html,
        width: +target.dataset.width,
        height: +target.dataset.height,
      });
    } else {
      return;
    }

    let { popups } = this.state;
    const was = popups.length;
    popups = popups.filter((p) => p.url !== props.url);
    if (popups.length === was) {
      popups = popups.concat(props);
    }
    this.setState({popups});
  }
  private makeHandleClose(url: string) {
    return () => {
      let { popups } = this.state;
      popups = popups.filter((p) => p.url !== url);
      this.setState({popups});
    };
  }
}

export function init() {
  const container = document.querySelector(POPUP_CONTAINER_SEL);
  if (container) {
    render(<Popups/>, container);
  }
}
