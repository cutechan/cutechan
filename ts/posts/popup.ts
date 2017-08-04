/**
 * Expand media attachments to the middle of the screen.
 */

import options from "../options"
import { getModel } from "../state"
import { Post } from "./model"
import { on, trigger, HOOKS } from "../util"
import {
  POPUP_CONTAINER_SEL,
  TRIGGER_MEDIA_POPUP_SEL,
  ZOOM_STEP_PX,
  HEADER_HEIGHT_PX,
} from "../vars"

let container = null as HTMLElement
let opened = 0
let lastUrl = ""

class Popup {
  private post = null as Post
  private el = null as HTMLElement
  private itemEl = null as HTMLVideoElement
  private url = ""
  private aspect = 0
  private moving = false
  private baseX = 0
  private baseY = 0
  private startX = 0
  private startY = 0

  constructor(post: Post) {
    this.post = post
    this.url = post.fileSrc
    if (this.url === lastUrl) return
    lastUrl = this.url

    const [width, height] = post.image.dims
    const rect = getCenteredRect({width, height})
    this.aspect = width / height

    this.el = document.createElement("div")
    this.el.className = "popup"
    this.el.style.left = rect.left + "px"
    this.el.style.top = rect.top + "px"

    if (post.image.video) {
      const media = this.itemEl = document.createElement("video") as any
      media.loop = true
      media.autoplay = true
      media.controls = this.needControls()
      media.volume = options.volume
      media.addEventListener("volumechange", function() {
        options.volume = media.volume
      })
    } else {
      this.itemEl = document.createElement("img") as any
    }
    this.itemEl.src = this.url
    this.itemEl.width = rect.width
    this.itemEl.className = "popup-item"
    this.el.appendChild(this.itemEl)

    this.attach()
  }
  needControls() {
    return (
      this.post.image.video
      && !this.post.transparentThumb
      && (this.post.image.audio || this.post.image.length > 3)
    )
  }
  isControlsClick(e: MouseEvent) {
    if (!this.itemEl.controls) return false
    // <https://stackoverflow.com/a/22928167>.
    const ctrlHeight = 50
    const rect = this.itemEl.getBoundingClientRect()
    const relY = e.clientY - rect.top
    return relY > rect.height - ctrlHeight
  }
  handleClick = (e: MouseEvent) => {
    // if (!Settings.get("popupBackdrop")) return
    if (e.target !== this.itemEl) {
      this.detach()
    }
  }
  handleKey = (e: KeyboardEvent) => {
    if (e.keyCode === 27) {
      this.detach()
    }
  }
  handleMediaClick = (e: MouseEvent) => {
    if (!this.isControlsClick(e)) {
      e.preventDefault()
    }
  }
  handleMediaDrag = (e: DragEvent) => {
    e.preventDefault()
  }
  handlePopupMouseDown = (e: MouseEvent) => {
    if (e.button !== 0 || this.isControlsClick(e)) return
    this.moving = true
    this.baseX = e.clientX
    this.baseY = e.clientY
    this.startX = this.el.offsetLeft
    this.startY = this.el.offsetTop
  }
  handleMouseMove = (e: MouseEvent) => {
    if (this.moving) {
      this.el.style.left = (this.startX + e.clientX - this.baseX) + "px"
      this.el.style.top = (this.startY + e.clientY - this.baseY) + "px"
    }
  }
  handlePopupMouseUp = (e: MouseEvent) => {
    this.moving = false
    if (e.button === 0
        && e.clientX === this.baseX
        && e.clientY === this.baseY
        && !this.isControlsClick(e)) {
      this.detach()
    }
  }
  handlePopupWheel = (e: WheelEvent) => {
    e.preventDefault()
    const order = e.deltaY < 0 ? 1 : -1
    let w = this.itemEl.width
    if (w <= 50 && order < 0) return
    w = Math.max(50, w + ZOOM_STEP_PX * order)
    this.itemEl.width = w
    const l = this.el.offsetLeft - (ZOOM_STEP_PX / 2) * order
    const t = this.el.offsetTop - (ZOOM_STEP_PX / this.aspect / 2) * order
    this.el.style.left = l + "px"
    this.el.style.top = t + "px"
  }
  attach() {
    container.appendChild(this.el)
    document.addEventListener("click", this.handleClick)
    document.addEventListener("keydown", this.handleKey)
    document.addEventListener("mousemove", this.handleMouseMove)
    this.itemEl.addEventListener("click", this.handleMediaClick)
    this.itemEl.addEventListener("dragstart", this.handleMediaDrag)
    this.el.addEventListener("mousedown", this.handlePopupMouseDown)
    this.el.addEventListener("mouseup", this.handlePopupMouseUp)
    this.el.addEventListener("wheel", this.handlePopupWheel)
    opened += 1
    trigger(HOOKS.openPostPopup)
  }
  detach() {
    document.removeEventListener("mousemove", this.handleMouseMove)
    document.removeEventListener("keydown", this.handleKey)
    document.removeEventListener("click", this.handleClick)
    this.el.remove()
    if (this.url === lastUrl) lastUrl = ""
    opened -= 1
  }
}

function open(e: MouseEvent) {
  if (e.button !== 0) return

  const post = getModel(e.target as Element)
  if (!post) return

  e.preventDefault()
  new Popup(post)
}

export function isOpen(): boolean {
  return opened > 0
}

export function getCenteredRect({ width, height }: any) {
  const aspect = width / height
  const pW = document.body.clientWidth
  const pH = window.innerHeight - HEADER_HEIGHT_PX
  width = Math.min(width, pW)
  height = Math.ceil(width / aspect)
  if (height > pH) {
    height = pH
    width = Math.ceil(height * aspect)
  }
  const left = (pW - width) / 2
  const top = (pH - height) / 2 + HEADER_HEIGHT_PX
  return {width, height, left, top}
}

export function init() {
  container = document.querySelector(POPUP_CONTAINER_SEL)
  on(document, "click", open, {
    selector: TRIGGER_MEDIA_POPUP_SEL,
  })
}
