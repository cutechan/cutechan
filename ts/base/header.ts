import View from "./view";

// Stores the views of all HeaderModal instances
const headerModals: { [key: string]: HeaderModal } = {};

// View of the modal currently displayed, if any
let visible: HeaderModal;

// A modal element, that is positioned fixed right beneath the header
export class HeaderModal extends View<null> {
  // Hook to execute, when the the modal is displayed
  protected showHook: () => void;

  constructor(el: HTMLElement) {
    super({ el });
    headerModals[this.id] = this;

    // Add click listener to the toggle button of the modal in the header
    document
      .getElementById("header-" + (this.id as string).split("-")[0])
      .addEventListener("click", () => this.toggle(), { capture: true });
  }

  // Show the element, if hidden, hide - if shown. Hide already visible
  // header modal, if any.
  private toggle() {
    if (visible) {
      const old = visible;
      visible.hide();
      if (old !== this) {
        this.show();
      }
    } else {
      this.show();
    }
  }

  // Unhide the element. If the element has not been rendered yet, do it.
  private show() {
    this.el.style.display = "block";
    visible = this;
    if (this.showHook) {
      this.showHook();
    }
  }

  // Hide the element
  private hide() {
    this.el.style.display = "none";
    visible = null;
  }
}

// A view that supports switching between multiple tabs.
export class TabbedModal extends HeaderModal {
  constructor(el: HTMLElement) {
    super(el);
    this.onClick({
      ".tab-link": (e) =>
        this.switchTab(e),
    });
  }

  // Show/hide modal content.
  // XXX(Kagami): These modals are awful.
  public toggleContent(show: boolean) {
    this.el.classList.toggle("tabmodal_empty", !show);
  }

  // Function to execute on tab switching.
  // Do nothing by default.
  protected tabHook(id: number, el: Element) {
    /* empty */
  }

  // Switch to a tab, when clicking the tab header.
  private switchTab(event: Event) {
    // Deselect previous tab.
    for (const selected of this.el.querySelectorAll(".tab-sel")) {
      selected.classList.remove("tab-sel");
    }

    // Select the new one.
    const el = event.target as HTMLElement;
    el.classList.add("tab-sel");

    // Select tab content.
    const id = el.getAttribute("data-id");
    let tabEl = null;
    for (tabEl of this.el.querySelectorAll(".tab-cont > div")) {
      if (tabEl.getAttribute("data-id") === id) {
        tabEl.classList.add("tab-sel");
        break;
      }
    }
    this.tabHook(+id, tabEl);
  }
}
