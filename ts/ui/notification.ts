import { View } from "../base";
import _ from "../lang";
import options from "../options";
import { Post } from "../posts";
import { mine } from "../state";
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
  if (
    !options.notification ||
    typeof Notification !== "function" ||
    (Notification as any).permission !== "granted"
  )
    return;

  // Finally display sticky notification.
  let icon = "";
  if (!options.workModeToggle) {
    if (post.files) {
      icon = post.getFileByIndex(0).thumb;
    } else {
      icon = DEFAULT_NOTIFICATION_IMAGE_URL;
    }
  }
  const n = new Notification(_("quoted"), {
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
    super({ el: null }); // importTemplate("notification").firstChild as HTMLElement });
    this.on("click", () => this.remove());
    this.el.querySelector("b").textContent = text;
    // overlay.prepend(this.el)
  }
}
