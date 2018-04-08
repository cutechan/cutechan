import { View, ViewAttrs } from "../base";
import { importTemplate } from "../util";

abstract class FormView extends View<null> {
  constructor(attrs: ViewAttrs) {
    super(attrs);
    this.onClick({
      ".array-add": (e) =>
        this.addInput(e, "arrayItem"),
      ".map-add": (e) =>
        this.addInput(e, "keyValue"),
      ".map-remove, .array-remove": (e) =>
        this.removeInput(e),
      "input[name=cancel]": () =>
        this.remove(),
    });
    this.on("submit", (e) =>
      this.submit(e));
  }

  protected abstract send(): void;

  // Render a text comment about the response status below the form
  protected renderFormResponse(text: string) {
    this.el.querySelector(".form-response").textContent = text;
  }

  // Submit form to server. Pass it to the assigned handler function
  private submit(event: Event) {
    event.preventDefault();
    this.send();
  }

  private addInput(event: Event, id: string) {
    (event.target as Element).before(importTemplate(id));
  }

  private removeInput(event: Event) {
    (event.target as Element).closest("span").remove();
  }
}

export default FormView;
