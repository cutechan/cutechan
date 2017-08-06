/**
 * Expand media attachments to the middle of the screen.
 */

import options from "../options";
import { getModel } from "../state";
import { HOOKS, makeNode, on, remove, trigger } from "../util";
import {
  HEADER_HEIGHT_PX,
  POPUP_CONTAINER_SEL,
  POST_EMBED_SEL,
  POST_FILE_THUMB_SEL,
  TRIGGER_MEDIA_POPUP_SEL,
  ZOOM_STEP_PX,
} from "../vars";

let container = null as HTMLElement;
const opened = [] as [Popup];

interface PopupArgs {
  video: boolean;
  audio: boolean;
  embed: boolean;
  transparent: boolean;
  url: string;
  html: string;
  width: number;
  height: number;
  duration: number;
}

class Popup {
  public args = null as PopupArgs;
  private el = null as HTMLElement;
  private itemEl = null as HTMLVideoElement;
  private aspect = 0;
  private moving = false;
  private baseX = 0;
  private baseY = 0;
  private startX = 0;
  private startY = 0;

  constructor(args: PopupArgs) {
    this.args = args;

    const { width, height } = args;
    const rect = getCenteredRect({width, height});
    this.aspect = width / height;

    this.el = document.createElement("div");
    this.el.className = "popup";
    this.el.style.left = rect.left + "px";
    this.el.style.top = rect.top + "px";

    if (args.video) {
      const media = this.itemEl = document.createElement("video") as any;
      media.loop = true;
      media.autoplay = true;
      media.controls = this.needControls();
      media.volume = options.volume;
      media.addEventListener("volumechange", () => {
        options.volume = media.volume;
      });
      media.src = args.url;
    } else if (args.embed) {
      const iframe = this.itemEl = makeNode(args.html) as any;
      iframe.height = rect.height;
      iframe.setAttribute("allowfullscreen", "");
      iframe.setAttribute("frameborder", "0");
      iframe.setAttribute("referrerpolicy", "no-referrer");
      // Restrict iframe access to the page. Improves privacy.
      iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
    } else {
      this.itemEl = document.createElement("img") as any;
      this.itemEl.src = args.url;
    }
    this.itemEl.width = rect.width;
    this.itemEl.className = "popup-item";
    this.el.appendChild(this.itemEl);
  }
  private needControls() {
    return (
      this.args.video
      && !this.args.transparent
      && (this.args.audio || this.args.duration > 3)
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
  private handleClick = (e: MouseEvent) => {
    if (e.button !== 0 || !options.popupBackdrop) return;
    if (e.target !== this.itemEl) {
      this.detach();
    }
  }
  private handleKey = (e: KeyboardEvent) => {
    if (e.keyCode === 27) {
      this.detach();
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
  private handlePopupMouseDown = (e: MouseEvent) => {
    if (e.button !== 0 || this.isControlsClick(e)) return;
    this.moving = true;
    this.baseX = e.clientX;
    this.baseY = e.clientY;
    this.startX = this.el.offsetLeft;
    this.startY = this.el.offsetTop;
  }
  private handleMouseMove = (e: MouseEvent) => {
    if (this.moving) {
      this.el.style.left = (this.startX + e.clientX - this.baseX) + "px";
      this.el.style.top = (this.startY + e.clientY - this.baseY) + "px";
    }
  }
  private handlePopupMouseUp = (e: MouseEvent) => {
    this.moving = false;
    if (e.button === 0
        && e.clientX === this.baseX
        && e.clientY === this.baseY
        && !this.isControlsClick(e)) {
      this.detach();
    }
  }
  private handlePopupWheel = (e: WheelEvent) => {
    e.preventDefault();
    const order = e.deltaY < 0 ? 1 : -1;
    let w = this.itemEl.width;
    if (w <= 50 && order < 0) return;
    w = Math.max(50, w + ZOOM_STEP_PX * order);
    this.itemEl.width = w;
    const l = this.el.offsetLeft - (ZOOM_STEP_PX / 2) * order;
    const t = this.el.offsetTop - (ZOOM_STEP_PX / this.aspect / 2) * order;
    this.el.style.left = l + "px";
    this.el.style.top = t + "px";
  }
  public attach() {
    container.appendChild(this.el);
    document.addEventListener("click", this.handleClick);
    document.addEventListener("keydown", this.handleKey);
    document.addEventListener("mousemove", this.handleMouseMove);
    this.itemEl.addEventListener("click", this.handleMediaClick);
    this.itemEl.addEventListener("dragstart", this.handleMediaDrag);
    this.el.addEventListener("mousedown", this.handlePopupMouseDown);
    this.el.addEventListener("mouseup", this.handlePopupMouseUp);
    this.el.addEventListener("wheel", this.handlePopupWheel);
    opened.push(this);
    trigger(HOOKS.openPostPopup);
  }
  public detach() {
    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("keydown", this.handleKey);
    document.removeEventListener("click", this.handleClick);
    this.el.remove();
    remove(opened, this);
  }
}

function open(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.matches) return;
  if (e.button !== 0) return;
  e.preventDefault();

  const args = {
    video: false,
    audio: false,
    embed: false,
    transparent: false,
    url: "",
    html: "",
    width: 0,
    height: 0,
    duration: 0,
  };

  if (target.matches(POST_FILE_THUMB_SEL)) {
    const post = getModel(target);
    if (!post) return;
    Object.assign(args, {
      video: post.image.video,
      audio: post.image.audio,
      transparent: post.transparentThumb,
      url: post.fileSrc,
      width: post.image.dims[0],
      height: post.image.dims[1],
      duration: post.image.length,
    });
  } else if (target.matches(POST_EMBED_SEL)) {
    Object.assign(args, {
      embed: true,
      url: (target as HTMLLinkElement).href,
      html: target.dataset.html,
      width: +target.dataset.width,
      height: +target.dataset.height,
    });
  } else {
    return;
  }

  let dup = false;
  for (const popup of opened.slice()) {
    if (popup.args.url === args.url) {
      dup = true;
      popup.detach();
    }
  }
  if (dup) return;

  new Popup(args).attach();
}

export function isOpen(): boolean {
  return opened.length > 0;
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

export function init() {
  container = document.querySelector(POPUP_CONTAINER_SEL);
  on(document, "click", open, {
    selector: TRIGGER_MEDIA_POPUP_SEL,
  });
}
