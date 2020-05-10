import { AccountForm } from "./form";
import { validatePasswordMatch } from "./login-form";

// Changing password form.
export class PasswordChangeForm extends AccountForm {
  constructor() {
    super({ tag: "form" });
    this.renderPublicForm("/html/change-password").then(() =>
      validatePasswordMatch(this.el, "newPassword", "repeat")
    );
  }

  protected send() {
    this.postResponse("/api/change-password", (req) => {
      req.old = this.inputElement("oldPassword").value;
      req.new = this.inputElement("newPassword").value;
    });
  }
}
