import { View, ViewAttrs } from "../base";

abstract class FormView extends View<null> {
  constructor(attrs: ViewAttrs) {
    super(attrs);
    this.onClick({
      "input[name=cancel]": () => this.remove(),
    });
    this.on("submit", (e) => this.submit(e));
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
}

export default FormView;
