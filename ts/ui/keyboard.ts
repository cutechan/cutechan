/**
 * Keyboard shortcuts handling.
 */

import { POST_SEL } from "../vars"
import options from "../options"
import { page } from "../state"
import { getID, trigger, HOOKS } from "../util"

// Bind keyboard event listener to the document.
export function init() {
  document.addEventListener("keydown", handleShortcut)
}

function handleShortcut(event: KeyboardEvent) {
  let caught = false

  const anyModifier = event.altKey || event.metaKey || event.ctrlKey || event.shiftKey
  const inInput = "selectionStart" in event.target

  if (!anyModifier) {
    if (inInput) {
      switch (event.key) {
      case "Escape":
        caught = true
        ;(event.target as HTMLElement).blur()
        break
      }
    } else {
      switch (event.key) {
      case "ArrowLeft":
        caught = true
        navigatePost(true)
        break
      case "ArrowRight":
        caught = true
        navigatePost(false)
        break
      }
    }
  } else if (event.altKey) {
    switch (event.which) {
    case options.newPost:
      caught = true
      trigger(HOOKS.openReply)
      break
    case options.cancelPost:
      caught = true
      trigger(HOOKS.closeReply)
      break
    case options.selectFile:
      caught = true
      trigger(HOOKS.selectFile)
      break
    case options.previewPost:
      caught = true
      trigger(HOOKS.previewPost)
      break
    case options.workMode:
      caught = true
      options.workModeToggle = !options.workModeToggle
      break
    case 38:
      caught = true
      navigateUp()
      break
    }
  } else if (event.ctrlKey) {
    switch (event.key) {
    case "Enter":
      caught = true
      trigger(HOOKS.sendReply)
      break
    }
  }

  if (caught) {
    event.stopImmediatePropagation()
    event.preventDefault()
  }
}

// Navigate one level up the board tree, if possible.
function navigateUp() {
  if (page.thread) {
    location.href = "/all/"
  } else if (page.board !== "all") {
    location.href = "/all/"
  } else {
    location.href = "/"
  }
}

// Move focus to next or previous visible post in document order.
// Starts with first post if none is selected via current url fragment.
function navigatePost(reverse: boolean) {
  const all = Array.from(document.querySelectorAll(POST_SEL))
  const currentId = location.hash.slice(1)
  let current = document.getElementById("post" + currentId) || all[0]
  let currentIdx = all.indexOf(current)

  while (current) {
    currentIdx = reverse ? currentIdx - 1 : currentIdx + 1
    current = all[currentIdx]
    if (current && getComputedStyle(current).display !== "none") {
      break
    }
  }

  if (current) {
    location.hash = "#" + getID(current)
  }
}
