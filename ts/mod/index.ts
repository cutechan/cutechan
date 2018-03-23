// Login/logout/registration facilities for the account system

import { showAlert } from "../alerts";
import API from "../api";
import { TabbedModal } from "../base";
import lang, { ln } from "../lang";
import { Post } from "../posts";
import { getModel, page } from "../state";
import { FormView } from "../ui";
import { inputElement, on, postJSON } from "../util";
import { TRIGGER_BAN_BY_POST_SEL, TRIGGER_DELETE_POST_SEL } from "../vars";
import {
  BannerForm, BoardConfigForm, BoardCreationForm, BoardDeletionForm,
  PasswordChangeForm, ServerConfigForm, StaffAssignmentForm,
} from "./forms";

interface Constructable {
  new (): any;
}

// Possible staff access levels
export const enum ModerationLevel {
  notLoggedIn = - 1,
  notStaff,
  janitor,
  moderator,
  boardOwner,
  admin,
}

// Current staff position on this page.
export const position: ModerationLevel = (window as any).position;

// Current staff position on any boardl.
export const anyposition: ModerationLevel = (window as any).anyposition;

export function isStaff(): boolean {
  return position > ModerationLevel.notStaff;
}

export function isPowerUser(): boolean {
  return anyposition >= ModerationLevel.janitor;
}

// Set a password match validator function for 2 input elements, that are
// children of the passed element.
export function validatePasswordMatch(
  parent: Element, name1: string, name2: string,
) {
  const el1 = inputElement(parent, name1);
  const el2 = inputElement(parent, name2);
  el1.onchange = el2.onchange = () => {
    const s = el2.value !== el1.value ? lang.ui.mustMatch : "";
    el2.setCustomValidity(s);
  };
}

// Only active AccountPanel instance
export let accountPanel: AccountPanel;

let loginForm: LoginForm;
let registrationForm: LoginForm;

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
      "#setBanners": this.loadConditional(BannerForm),
      "#deleteBoard": this.loadConditional(BoardDeletionForm),
      "#configureServer": this.loadConditional(ServerConfigForm),
    });

    if (position === ModerationLevel.notLoggedIn) {
      this.tabHook = (id) => {
        switch (id) {
          case 0:
            loginForm.initCaptcha();
            break;
          case 1:
            registrationForm.initCaptcha();
            break;
        }
      };
      this.showHook = () => {
        loginForm.initCaptcha();
      };
    }
  }

  // Either hide or show the selection menu
  public toggleMenu(show: boolean) {
    document.getElementById("form-selection")
      .style
      .display = show ? "block" : "none";
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
    super({
      el: document.getElementById(id),
      lazyCaptcha: true,
    });
    this.url = "/api/" + url;
  }

  // Extract and send login ID and password and captcha (if any) from a form
  protected async send() {
    const id = this.inputElement("id").value.trim();
    const password = this.inputElement("password").value;
    const req = {id, password};
    this.injectCaptcha(req);
    const res = await postJSON(this.url, req);
    switch (res.status) {
      case 200:
        location.reload(true);
      default:
        this.renderFormResponse(await res.text());
    }
  }
}

function getModelByEvent(e: Event): Post {
  return getModel(e.target as Element);
}

function deletePost(post: Post, force?: boolean) {
  if (!force && !confirm(ln.UI.delConfirm)) return;
  API.post.delete([post.id]).then(() => {
    // In thread we should delete on WebSocket event.
    if (!page.thread) {
      post.setDeleted();
    }
  }, showAlert);
}

function banUser(post: Post) {
  if (!confirm(ln.UI.banConfirm)) return;
  const YEAR = 365 * 24 * 60;
  API.user.banByPost({
    // Hardcode for now.
    duration: YEAR,
    global: position >= ModerationLevel.admin,
    ids: [post.id],
    reason: "default",
  }).then(() => {
    deletePost(post, true);
  }).catch(showAlert);
}

// Init module.
export function init() {
  accountPanel = new AccountPanel();

  if (position === ModerationLevel.notLoggedIn) {
    loginForm = new LoginForm("login-form", "login");
    registrationForm = new LoginForm("registration-form", "register");
    validatePasswordMatch(registrationForm.el, "password", "repeat");
  }

  if (position > ModerationLevel.notStaff) {
    on(document, "click", (e) => {
      deletePost(getModelByEvent(e));
    }, {selector: TRIGGER_DELETE_POST_SEL});
    on(document, "click", (e) => {
      banUser(getModelByEvent(e));
    }, {selector: TRIGGER_BAN_BY_POST_SEL});
  }
}
