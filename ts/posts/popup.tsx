/**
 * Expand media attachments to the middle of the screen.
 */

import * as cx from "classnames";
import { Component, h, render } from "preact";
import { ln } from "../lang";
import options from "../options";
import { getModel } from "../state";
import {
  getFirefoxMajorVersion,
  HOOKS, on, setter as s, ShowHide, trigger,
} from "../util";
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
  frameLoaded: boolean;
}

class Popup extends Component<PopupProps, PopupState> {
  private itemEl = null as HTMLVideoElement;
  private frameUrl = "";
  private httpEmbed = false;
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
      this.httpEmbed = this.frameUrl.startsWith("http:");
    }

    this.state = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      moving: false,
      resizing: false,
      frameLoaded: false,
    };

  }
  public componentDidMount() {
    opened.add(this.props.url);
    trigger(HOOKS.openPostPopup);
    document.addEventListener("keydown", this.handleGlobalKey);
    document.addEventListener("mousemove", this.handleGlobalMove);
    document.addEventListener("click", this.handleGlobalClick);
    if (this.props.video) {
      this.itemEl.volume = options.volume;
      this.itemEl.src = this.props.url;
      // See https://bugzilla.mozilla.org/show_bug.cgi?id=1412617
      if (getFirefoxMajorVersion() >= 58) {
        document.addEventListener("click", this.handleGlobalVideoClick, true);
      }
    }
  }
  public componentWillUnmount() {
    opened.delete(this.props.url);
    document.removeEventListener("keydown", this.handleGlobalKey);
    document.removeEventListener("mousemove", this.handleGlobalMove);
    document.removeEventListener("click", this.handleGlobalClick);
    if (this.props.video && getFirefoxMajorVersion() >= 58) {
      document.removeEventListener("click", this.handleGlobalVideoClick, true);
    }
  }

  public render({ video, embed }: PopupProps, { left, top, frameLoaded }: PopupState) {
    const cls = video ? "popup_video" : embed ? "popup_embed" : "popup_image";
    return (
      <div class={cx("popup", cls)} style={{left, top}}>
        {(this.httpEmbed && !frameLoaded) ? this.renderEmbedHelp() : null}
        {video ? this.renderVideo()
               : embed ? this.renderEmbed() : this.renderImage()}
        {embed ? this.renderControls() : null}
      </div>
    );
  }
  private renderVideo() {
    const { width } = this.state;
    return (
      <video
        class="popup-item"
        ref={s(this, "itemEl")}
        style={{width}}
        loop
        autoPlay
        controls={this.needVideoControls()}
        onMouseDown={this.handleMediaDown}
        onClick={this.handleVideoClick}
        onWheel={this.handleMediaWheel}
        onVolumeChange={this.handleMediaVolume}
      />
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
        onLoad={this.handleFrameLoad}
      />
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
  private renderEmbedHelp() {
    // https://stackoverflow.com/a/9851769
    const isChrome = !!(window as any).chrome;
    const isFirefox = !!(window as any).InstallTrigger;
    const isOpera = !!(window as any).opr;

    const knownBrowser = isChrome || isFirefox || isOpera;
    const imageSuffix = isChrome ? "chrome" : isFirefox ? "firefox" : "opera";
    const imageURL = `/static/img/unblock-mixed-${imageSuffix}.png`;
    return (
      <div class="popup-embed-help" onClick={this.handleHelpClick}>
        <h3 class="help-header">{ln.UI.frameBlock}</h3>
        <ShowHide show={knownBrowser}>
          <p class="help-item">{ln.UI.frameUnblock}</p>
        </ShowHide>
        <ShowHide show={knownBrowser}>
          <p class="help-item"><img class="help-image" src={imageURL} /></p>
        </ShowHide>
        <p class="help-item">{ln.UI.frameDetails}</p>
        <p class="help-item">
          <a class="help-link" href="https://support.google.com/chrome/answer/1342714">
            <i class="fa fa-chrome"></i> support.google.com/chrome/answer/1342714
          </a>
          <a
            class="help-link"
            href="https://support.mozilla.org/ru/kb/kak-nebezopasnyj-kontent-mozhet-povliyat-na-moyu-b"
          >
            <i class="fa fa-firefox"></i>{" "}
            support.mozilla.org/ru/kb/kak-nebezopasnyj-kontent-mozhet-povliyat-na-moyu-b
          </a>
          <a class="help-link" href="http://help.opera.com/opera/Windows/2393/ru/private.html#blocked">
            <i class="fa fa-opera"></i> help.opera.com/opera/Windows/2393/ru/private.html#blocked
          </a>
        </p>
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
  private isVideoControlsClick(e: MouseEvent) {
    if (!this.props.video || !this.itemEl.controls) return false;
    // <https://stackoverflow.com/a/22928167>.
    const ctrlHeight = 50;
    const rect = this.itemEl.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    return relY > rect.height - ctrlHeight;
  }
  private handleGlobalKey = (e: KeyboardEvent) => {
    if (e.keyCode === 27) {
      this.props.onClose();
    }
  }
  private handleFrameLoad = () => {
    // There is no error event in case of mixed content (see
    // <https://bugs.chromium.org/p/chromium/issues/detail?id=449343>),
    // so need to detect the opposite way.
    this.setState({frameLoaded: true});
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
    if (e.button !== 0 || this.isVideoControlsClick(e)) return;
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
  private handleVideoClick = (e: MouseEvent) => {
    if (this.isVideoControlsClick(e)) {
      e.stopPropagation();
    } else {
      e.preventDefault();
    }
  }
  private handleControlsClick = (e: MouseEvent) => {
    e.stopPropagation();
    this.setState({moving: false, resizing: false});
  }
  private handleHelpClick = (e: MouseEvent) => {
    e.stopPropagation();
  }
  private handleGlobalVideoClick = (e: MouseEvent) => {
    if (this.isVideoControlsClick(e)) return;
    this.handleGlobalClick(e);
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
      const file = post.getFileByThumb((target as HTMLImageElement).src);
      Object.assign(props, {
        video: file.video,
        audio: file.audio,
        transparent: file.transparent,
        url: file.src,
        width: file.dims[0],
        height: file.dims[1],
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
