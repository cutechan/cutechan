import { validatePasswordMatch } from ".";
import { AccountForm } from "./form";

// View for changing a password
export class PasswordChangeForm extends AccountForm {
  constructor() {
    super({ tag: "form" });
    this.renderPublicForm("/html/change-password").then(() =>
      validatePasswordMatch(this.el, "newPassword", "repeat"));
  }

  protected send() {
    this.postResponse("/api/change-password", (req) => {
      req.old = this.inputElement("oldPassword").value;
      req.new = this.inputElement("newPassword").value;
    });
  }
}
