/**
 * Hooks for optional modules to execute code in exposed functions.
 */
// TODO(Kagami): Use this module instead of util/fsm and util/changes.

import { EventEmitter } from "events"

export const enum HOOKS {
  openReply,
  closeReply,
  sendReply,
  showAlert,
  openPostPopup,
  selectFile,
  previewPost,
}

const hooks = new EventEmitter()

/** Assigns a handler to execute on a hook name. */
export function hook(name: string | HOOKS, fn: (...args: any[]) => void) {
  hooks.addListener(name.toString(), fn)
}

/** Remove hook. */
export function unhook(name: string | HOOKS, fn: (...args: any[]) => void) {
  hooks.removeListener(name.toString(), fn)
}

/** Execute handler for a hook. */
export function trigger(name: string | HOOKS, ...args: any[]) {
  hooks.emit(name.toString(), ...args)
}
