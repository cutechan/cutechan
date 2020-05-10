import _ from "../lang";
import { FormView } from "../ui";
import { inputElement, sendJSON } from "../util";

// Set a password match validator function for 2 input elements, that
// are children of the passed element.
export function validatePasswordMatch(
  parent: Element,
  name1: string,
  name2: string
) {
  const el1 = inputElement(parent, name1);
  const el2 = inputElement(parent, name2);
  el1.onchange = el2.onchange = () => {
    const s = el2.value !== el1.value ? _("mustMatch") : "";
    el2.setCustomValidity(s);
  };
}

// Common functionality of login and registration forms.
export class LoginForm extends FormView {
  private url: string;

  constructor(id: string, url: string) {
    super({ el: document.getElementById(id) });
    this.url = "/api/" + url;
  }

  // Extract and send login ID and password from a form
  protected async send() {
    const id = this.inputElement("id").value.trim();
    const password = this.inputElement("password").value;
    const req = { id, password };
    const res = await sendJSON(this.url, req);
    switch (res.status) {
      case 200:
        location.reload(true);
      default:
        this.renderFormResponse(await res.text());
    }
  }
}
