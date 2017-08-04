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

// A view that supports switching between multiple tabs
// tslint:disable-next-line:max-classes-per-file
export class TabbedModal extends HeaderModal {
  // Hook a function to execute on tab switching
  protected tabHook: (id: number) => void;

  constructor(el: HTMLElement) {
    super(el);
    this.onClick({
      ".tab-link": (e) =>
        this.switchTab(e),
    });
  }

  // Switch to a tab, when clicking the tab butt
  private switchTab(event: Event) {
    const el = event.target as Element;

    // Deselect previous tab
    for (const selected of this.el.querySelectorAll(".tab-sel")) {
      selected.classList.remove("tab-sel");
    }

    // Select the new one
    el.classList.add("tab-sel");
    const id = el.getAttribute("data-id");
    for (const tabEl of this.el.querySelectorAll(`.tab-cont > div`)) {
      if (tabEl.getAttribute("data-id") !== id) {
        continue;
      }
      tabEl.classList.add("tab-sel");
    }

    if (this.tabHook) {
      this.tabHook(parseInt(id, 10));
    }
  }
}
