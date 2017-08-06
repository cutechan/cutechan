/**
 * Expand media attachments to the middle of the screen.
 */

import { Component, h, render } from "preact";
import options from "../options";
import { getModel } from "../state";
import { HOOKS, on, setter as s, trigger } from "../util";
import {
  HEADER_HEIGHT_PX,
  POPUP_CONTAINER_SEL,
  POST_EMBED_SEL,
  POST_FILE_THUMB_SEL,
  TRIGGER_MEDIA_POPUP_SEL,
  ZOOM_STEP_PX,
} from "../vars";

let opened = 0;

export function isOpen(): boolean {
  return opened > 0;
}

export function getCenteredRect({ width, height }: any) {
  const aspect = width / height;
  const pW = document.body.clientWidth;
  const pH = window.innerHeight - HEADER_HEIGHT_PX;
  width = Math.min(width, pW);
  height = Math.ceil(width / aspect);
  if (height > pH) {
    height = pH;
    width = Math.ceil(height * aspect);
  }
  const left = (pW - width) / 2;
  const top = (pH - height) / 2 + HEADER_HEIGHT_PX;
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
}

class Popup extends Component<PopupProps, PopupState> {
  private itemEl = null as HTMLVideoElement;
  private frameUrl = "";
  private aspect = 0;
  private moving = false;
  private baseX = 0;
  private baseY = 0;
  private startX = 0;
  private startY = 0;

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
    };

  }
  public componentDidMount() {
    opened += 1;
    trigger(HOOKS.openPostPopup);
    document.addEventListener("click", this.handleGlobalClick);
    document.addEventListener("keydown", this.handleGlobalKey);
    document.addEventListener("mousemove", this.handleGlobalMove);
    if (this.props.video) {
      this.itemEl.volume = options.volume;
      this.itemEl.src = this.props.url;
    }
  }
  public componentWillUnmount() {
    opened -= 1;
    document.removeEventListener("mousemove", this.handleGlobalMove);
    document.removeEventListener("keydown", this.handleGlobalKey);
    document.removeEventListener("click", this.handleGlobalClick);
  }

  public render({ video, embed }: PopupProps, { left, top }: PopupState) {
    return (
      <div
        class="popup"
        style={{left, top}}
        onMouseDown={this.handlePopupMouseDown}
        onMouseUp={this.handlePopupMouseUp}
        onWheel={this.handlePopupWheel}
      >
        {video ? this.renderVideo()
               : embed ? this.renderEmbed() : this.renderImage()}
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
        onClick={this.handleMediaClick}
        onDragStart={this.handleMediaDrag}
        onVolumeChange={this.handleMediaVolume}
      />
    );
  }
  private renderEmbed() {
    const { width, height } = this.state;
    return (
      <iframe
        class="popup-item"
        ref={s(this, "itemEl")}
        style={{width, height}}
        allowFullScreen
        frameBorder={0}
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin"
        src={this.frameUrl}
        onClick={this.handleMediaClick}
        onDragStart={this.handleMediaDrag}
        onVolumeChange={this.handleMediaVolume}
      />
    );
  }
  private renderImage() {
    const { url } = this.props;
    const { width } = this.state;
    return (
      <img
        class="popup-item"
        ref={s(this, "itemEl")}
        style={{width}}
        src={url}
        onClick={this.handleMediaClick}
        onDragStart={this.handleMediaDrag}
      />
    );
  }

  private needVideoControls() {
    return (
      this.props.video
      && !this.props.transparent
      && (this.props.audio || this.props.duration > 3)
    );
  }
  private isControlsClick(e: MouseEvent) {
    if (!this.itemEl.controls) return false;
    // <https://stackoverflow.com/a/22928167>.
    const ctrlHeight = 50;
    const rect = this.itemEl.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    return relY > rect.height - ctrlHeight;
  }
  private handleGlobalClick = (e: MouseEvent) => {
    if (e.button !== 0 || !options.popupBackdrop) return;
    if (e.target !== this.itemEl) {
      this.props.onClose();
    }
  }
  private handleGlobalKey = (e: KeyboardEvent) => {
    if (e.keyCode === 27) {
      this.props.onClose();
    }
  }
  private handleMediaClick = (e: MouseEvent) => {
    if (!this.isControlsClick(e)) {
      e.preventDefault();
    }
  }
  private handleMediaDrag = (e: DragEvent) => {
    e.preventDefault();
  }
  private handleMediaVolume = () => {
    options.volume = this.itemEl.volume;
  }
  private handlePopupMouseDown = (e: MouseEvent) => {
    if (e.button !== 0 || this.isControlsClick(e)) return;
    this.moving = true;
    this.baseX = e.clientX;
    this.baseY = e.clientY;
    this.startX = this.state.left;
    this.startY = this.state.top;
  }
  private handleGlobalMove = (e: MouseEvent) => {
    if (this.moving) {
      this.setState({
        left: (this.startX + e.clientX - this.baseX),
        top: (this.startY + e.clientY - this.baseY),
      });
    }
  }
  private handlePopupMouseUp = (e: MouseEvent) => {
    this.moving = false;
    if (e.button === 0
        && e.clientX === this.baseX
        && e.clientY === this.baseY
        && !this.isControlsClick(e)) {
      this.props.onClose();
    }
  }
  private handlePopupWheel = (e: WheelEvent) => {
    e.preventDefault();
    const order = e.deltaY < 0 ? 1 : -1;
    const { left, top, width } = this.state;
    if (width <= 50 && order < 0) return;
    this.setState({
      left: left - (ZOOM_STEP_PX / 2) * order,
      top: top - (ZOOM_STEP_PX / this.aspect / 2) * order,
      // TODO(Kagami): Calc height;
      width: Math.max(50, width + ZOOM_STEP_PX * order),
    });
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
      if (!post) return;
      Object.assign(props, {
        video: post.image.video,
        audio: post.image.audio,
        transparent: post.transparentThumb,
        url: post.fileSrc,
        width: post.image.dims[0],
        height: post.image.dims[1],
        duration: post.image.length,
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
