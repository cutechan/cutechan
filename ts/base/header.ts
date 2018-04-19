import View from "./view";

// Stores the views of all HeaderModal instances
const headerModals: { [key: string]: HeaderModal } = {};

// View of the modal currently displayed, if any
let visible: HeaderModal;

// A modal element, that is positioned fixed right beneath the header
export class HeaderModal extends View<null> {
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
  public toggle = () => {
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
  public show = () => {
    this.el.style.display = "block";
    visible = this;
    this.showHook();
  }

  // Hide the element
  public hide = () => {
    this.el.style.display = "none";
    visible = null;
  }

  // Hook to execute when the the modal is displayed.
  // Do nothing by default.
  protected showHook() {
    /* empty */
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
    this.el.classList.toggle("tab-modal_empty", !show);
  }

  // Trigger hook for current tab.
  protected showHook() {
    const tabEl = this.el.querySelector(".tab-cont .tab-sel");
    if (tabEl) {
      this.tabHook(tabEl);
    }
  }

  // Function to execute on tab switching.
  // Do nothing by default.
  protected tabHook(tabEl: Element) {
    /* empty */
  }

  // Switch to a tab, when clicking the tab header.
  private switchTab(event: Event) {
    for (const el of this.el.querySelectorAll(".tab-sel")) {
      el.classList.remove("tab-sel");
    }
    const tabHeadEl = event.target as Element;
    tabHeadEl.classList.add("tab-sel");
    const id = +tabHeadEl.getAttribute("data-id");
    const tabEl = this.el.querySelector(`.tab-cont [data-id='${id}']`);
    tabEl.classList.add("tab-sel");
    this.tabHook(tabEl);
  }
}
