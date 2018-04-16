/**
 * Account modal handling.
 *
 * @module cutechan/account
 */

import { showAlert } from "../alerts";
import { TabbedModal } from "../base";
import { ModerationLevel, position } from "../mod";
import { Constructable } from "../util";
import {
  BoardConfigForm, BoardCreationForm, BoardDeletionForm, StaffAssignmentForm,
} from "./board-form";
import { LoginForm, validatePasswordMatch } from "./login-form";
import { PasswordChangeForm } from "./password-form";
import { ServerConfigForm } from "./server-form";

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
