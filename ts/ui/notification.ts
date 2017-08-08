import { View } from "../base";
import lang from "../lang";
import options from "../options";
import { Post, thumbPath } from "../posts";
import { mine } from "../state";
import { importTemplate } from "../util";
import { DEFAULT_NOTIFICATION_IMAGE_URL } from "../vars";
import { repliedToMe } from "./tab";

// Notify the user that one of their posts has been replied to.
export default function notifyAboutReply(post: Post) {
  // Ignore my replies to me (lol samefag).
  if (mine.has(post.id)) return;

  // Check if already seen.
  if (post.seen()) return;

  // Update favicon status;
  repliedToMe(post);

  // Check if notifications are available.
  if (!options.notification
      || typeof Notification !== "function"
      || (Notification as any).permission !== "granted"
  ) return;

  // Finally display sticky notification.
  let icon = "";
  if (!options.workModeToggle) {
    if (post.image) {
      const { thumbType, SHA1 } = post.image;
      icon = thumbPath(thumbType, SHA1);
    } else {
      icon = DEFAULT_NOTIFICATION_IMAGE_URL;
    }
  }
  const n = new Notification(lang.ui.quoted, {
    body: post.body,
    icon,
    vibrate: true,
  });
  n.onclick = () => {
    n.close();
    window.focus();
    location.hash = "#" + post.id;
  };
}

// Textual notification at the top of the page
// TODO(Kagami): Rework.
export class OverlayNotification extends View<null> {
  constructor(text: string) {
    super({ el: importTemplate("notification").firstChild as HTMLElement });
    this.on("click", () =>
      this.remove());
    this.el.querySelector("b").textContent = text;
    // overlay.prepend(this.el)
  }
}
