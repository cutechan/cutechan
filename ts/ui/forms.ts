import { View, ViewAttrs } from "../base";

const arrayItemForm = `
  <span
    ><input type="text" class="array-field" value=""
    ><a class="array-remove"
    >[X]</a
    ><br
  ></span>
`.trim();

abstract class FormView extends View<null> {
  constructor(attrs: ViewAttrs) {
    super(attrs);
    this.onClick({
      ".array-add": (e) =>
        this.addInput(e, arrayItemForm),
      ".array-remove": (e) =>
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

  private addInput(event: Event, html: string) {
    (event.target as Element).insertAdjacentHTML("beforebegin", html);
  }

  private removeInput(event: Event) {
    (event.target as Element).closest("span").remove();
  }
}

export default FormView;
