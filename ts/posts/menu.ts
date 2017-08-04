import { showAlert } from "../alerts";
import { View } from "../base";
import { PostData } from "../common";
import lang from "../lang";
import { ModerationLevel, position } from "../mod";
import { getModel } from "../state";
import { on } from "../util";
import { postJSON } from "../util";
import CollectionView from "./collectionView";
import { hidePost } from "./hide";
import { Post } from "./model";

interface ControlButton extends Element {
  _popup_menu: MenuView;
}

// Spec for a single item of the drop down menu
interface ItemSpec {
  text: string;
  shouldRender: (m: Post) => boolean;
  handler: (m: Post) => void | Promise<void>;
}

// Actions to be performed by the items in the popup menu
const actions: { [key: string]: ItemSpec } = {
  deleteSameIP: {
    shouldRender: canModerateIP,
    text: lang.posts.deleteBySameIP,
    async handler(m) {
      const posts = await getSameIPPosts(m);
      if (!posts) {
        return;
      }
      if (!confirm(lang.ui.confirmDelete)) {
        return;
      }
      const res = await postJSON("/api/delete-post", posts.map((p) => p.id));
      if (res.status !== 200) {
        showAlert(await res.text());
      }
    },
  },
  hide: {
    handler: hidePost,
    text: lang.posts.hide,
    shouldRender(m) {
      return true;
    },
  },
  toggleSticky: {
    text: lang.posts.toggleSticky,
    shouldRender(m) {
      return position >= ModerationLevel.moderator && m.id === m.op;
    },
    // Toggle sticky flag on a thread
    async handler(m) {
      const res = await postJSON("/api/sticky", {
        id: m.id,
        sticky: !m.sticky,
      });
      if (res.status !== 200) {
        return showAlert(await res.text());
      }
      m.sticky = !m.sticky;
      m.view.renderSticky();
    },
  },
  viewSameIP: {
    shouldRender: canModerateIP,
    text: lang.posts.viewBySameIP,
    async handler(m) {
      // tslint:disable-next-line:no-unused-expression
      new CollectionView(await getSameIPPosts(m));
    },
  },
};

// Returns, if the post still likely has an IP attached and the client is
// logged in
function canModerateIP(m: Post): boolean {
  return position >= ModerationLevel.janitor
    && m.time > Date.now() / 1000 - 24 * 7 * 3600;
}

// Post header drop down menu
class MenuView extends View<Post> {
  public el: HTMLElement;
  private parent: ControlButton;

  constructor(parent: ControlButton, model: Post) {
    super({
      class: "popup-menu",
      model,
      tag: "ul",
    });
    this.parent = parent;
    parent._popup_menu = this;
    this.render();
    this.on("click", (e) => this.handleClick(e), {
      passive: true,
    });
  }

  // Also dereference from parent .control element
  public remove() {
    this.parent._popup_menu = null;
    super.remove();
  }

  private render() {
    for (const key of Object.keys(actions)) {
      const { shouldRender, text } = actions[key];
      if (!shouldRender(this.model)) {
        continue;
      }
      const li = document.createElement("li");
      li.setAttribute("data-id", key);
      li.textContent = text;
      this.el.append(li);
    }
    this.parent.append(this.el);
  }

  // Run appropriate handler on click or simply remove the menu
  private handleClick(e: Event) {
    actions[(e.target as Element).getAttribute("data-id")]
      .handler(this.model);
    this.remove();
  }
}

// Open a popup menu, after clicking on a .control down arrow
function openMenu(e: Event) {
  const parent = (e.target as Element).closest(".control") as ControlButton;

  if (parent._popup_menu) {
    return parent._popup_menu.remove();
  }

  const model = getModel(parent);
  if (model) {
    // tslint:disable-next-line:no-unused-expression
    new MenuView(parent, model);
  }
}

// Fetch posts with the same IP on this board
async function getSameIPPosts(m: Post): Promise<PostData[]> {
  const res = await postJSON(`/api/same-IP/${m.id}`, null);
  if (res.status !== 200) {
    showAlert(await res.text());
    return;
  }
  return await res.json();
}

export default () =>
  on(document, "click", openMenu, {
    passive: true,
    selector: ".control, .control svg, .control svg path",
  });
