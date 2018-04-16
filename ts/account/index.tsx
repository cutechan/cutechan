/**
 * Account modal handling.
 *
 * @module cutechan/account
 */

import { showAlert } from "../alerts";
import { TabbedModal } from "../base";
import { ln } from "../lang";
import { ModerationLevel, position } from "../mod";
import {
  BoardConfigForm, BoardCreationForm, BoardDeletionForm,
  StaffAssignmentForm,
} from "../mod/board-form";
import { ServerConfigForm } from "../mod/server-form";
import { FormView } from "../ui";
import { inputElement, postJSON } from "../util";
import { PasswordChangeForm } from "./password-form";

// Set a password match validator function for 2 input elements, that are
// children of the passed element.
export function validatePasswordMatch(
  parent: Element, name1: string, name2: string,
) {
  const el1 = inputElement(parent, name1);
  const el2 = inputElement(parent, name2);
  el1.onchange = el2.onchange = () => {
    const s = el2.value !== el1.value ? ln.UI.mustMatch : "";
    el2.setCustomValidity(s);
  };
}

// Terminate the user session(s) server-side and reset the panel
async function logout(url: string) {
  const res = await fetch(url, {
    credentials: "include",
    method: "POST",
  });
  switch (res.status) {
    case 200:
    case 403: // Does not really matter, if the session already expired
      location.reload(true);
    default:
      showAlert(await res.text());
  }
}

// Common functionality of login and registration forms
class LoginForm extends FormView {
  private url: string;

  constructor(id: string, url: string) {
    super({el: document.getElementById(id)});
    this.url = "/api/" + url;
  }

  // Extract and send login ID and password from a form
  protected async send() {
    const id = this.inputElement("id").value.trim();
    const password = this.inputElement("password").value;
    const req = {id, password};
    const res = await postJSON(this.url, req);
    switch (res.status) {
      case 200:
        location.reload(true);
      default:
        this.renderFormResponse(await res.text());
    }
  }
}

interface Constructable {
  new (): any;
}

// Account login and registration
class AccountPanel extends TabbedModal {
  constructor() {
    super(document.getElementById("account-panel"));
    this.onClick({
      "#logout": () => logout("/api/logout"),
      "#logoutAll": () => logout("/api/logout/all"),
      "#changePassword": this.loadConditional(PasswordChangeForm),
      "#createBoard": this.loadConditional(BoardCreationForm),
      "#configureBoard": this.loadConditional(BoardConfigForm),
      "#assignStaff": this.loadConditional(StaffAssignmentForm),
      "#deleteBoard": this.loadConditional(BoardDeletionForm),
      "#configureServer": this.loadConditional(ServerConfigForm),
    });
  }

  // Either hide or show the selection menu
  public toggleMenu(show: boolean) {
    const form = document.getElementById("form-selection");
    form.style.display = show ? "block" : "none";
  }

  // Create handler for dynamically loading and rendering conditional view
  // modules
  private loadConditional(m: Constructable): EventListener {
    return () => {
      this.toggleMenu(false);
      // tslint:disable-next-line:no-unused-expression
      new m();
    };
  }
}

export let accountPanel: AccountPanel = null;

export function init() {
  accountPanel = new AccountPanel();
  if (position === ModerationLevel.notLoggedIn) {
    // tslint:disable-next-line:no-unused-expression
    new LoginForm("login-form", "login");
    const registrationForm = new LoginForm("registration-form", "register");
    validatePasswordMatch(registrationForm.el, "password", "repeat");
  }
}
