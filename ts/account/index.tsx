/**
 * Account handling.
 *
 * @module cutechan/account
 */

import * as cx from "classnames";
import { Component, h, render } from "preact";
import { showAlert, showSendAlert } from "../alerts";
import API from "../api";
import { TabbedModal } from "../base";
import { _ } from "../lang";
import { ModerationLevel, position } from "../mod";
import { getModel } from "../state";
import {
  BackgroundClickMixin, Constructable, EscapePressMixin,
  hook, HOOKS, on, trigger, unhook,
} from "../util";
import { MODAL_CONTAINER_SEL, TRIGGER_IGNORE_USER_SEL } from "../vars";
import {
  BoardConfigForm, BoardCreationForm, BoardDeletionForm, StaffAssignmentForm,
} from "./board-form";
import { LoginForm, validatePasswordMatch } from "./login-form";
import { PasswordChangeForm } from "./password-form";
import { ServerConfigForm } from "./server-form";

export const enum IgnoreMode {
  disabled,
  byWhitelist,
  byBlacklist,
}

export interface AccountSettings {
  name?: string;
  showName?: boolean;
  ignoreMode?: IgnoreMode;
  whitelist?: string[];
  blacklist?: string[];
}

declare global {
  interface Window {
    account: AccountSettings;
  }
}

export const account = window.account;

interface IdentityProps {
  modal: AccountPanel;
}

interface IdentityState extends AccountSettings {
  saving: boolean;
}

class IdentityTab extends Component<IdentityProps, IdentityState> {
  constructor(props: IdentityProps) {
    super(props);
    this.state = {saving: false, ...account};
  }
  public render({}, { name, showName, saving }: IdentityState) {
    return (
      <div class="account-identity-tab-inner">
        <h3 class="account-form-header">
          {_("Show name")}
        </h3>
        <div class="account-form-section">
          <input
            class="account-form-showname option-checkbox"
            type="checkbox"
            checked={showName}
            onChange={this.handleShowNameToggle}
          />
          <input
            class="account-form-name"
            type="text"
            placeholder={_("Name")}
            value={name}
            onChange={this.handleNameChange}
          />
        </div>
        <button class="button account-save-button" onClick={this.handleSave}>
          <i class={cx("account-save-icon fa", {
            "fa-spinner fa-pulse fa-fw": saving,
            "fa-check-circle": !saving,
          })} />
          {_("Save")}
        </button>
      </div>
    );
  }
  private handleShowNameToggle = (e: Event) => {
    e.preventDefault();
    const showName = !this.state.showName;
    this.setState({showName});
  }
  private handleNameChange = (e: Event) => {
    const name = (e.target as HTMLInputElement).value;
    this.setState({name});
  }
  private handleSave = () => {
    const { modal } = this.props;
    const { name, showName } = this.state;
    const settings = { name, showName };
    this.setState({saving: true});
    API.account.setSettings(settings)
      .then(modal.hide, showSendAlert)
      .then(() => {
        this.setState({saving: false});
      });
  }
}

interface IgnoreState {
  target?: HTMLElement;
  shown: boolean;
  left: number;
  top: number;
  userId: string;
}

class IgnoreModalBase extends Component<{}, IgnoreState> {
  public state: IgnoreState = {
    target: null,
    userId: "",
    shown: false,
    left: 0,
    top: 0,
  };
  public componentDidMount() {
    hook(HOOKS.openIgnoreModal, this.showModal);
  }
  public componentWillUnmount() {
    unhook(HOOKS.openIgnoreModal, this.showModal);
  }
  public render({}, { userId, shown, left, top }: IgnoreState) {
    if (!shown) return null;
    const style = {left, top};
    return (
      <div
        class="ignore-modal"
        style={style}
        onClick={this.handleModalClick}
      >
        <div class="ignore-modal-info">
          {userId}
        </div>
        <div class="ignore-modal-item">
          <i class="control fa fa-check-circle" />
          <span> {_("To whitelist")}</span>
        </div>
        <div class="ignore-modal-item">
          <i class="control fa fa-times-circle" />
          <span> {_("To blacklist")}</span>
        </div>
      </div>
    );
  }
  public onBackgroundClick = (e: MouseEvent) => {
    if (e.target === this.state.target) return;
    if (this.state.shown) {
      this.setState({target: null, shown: false});
    }
  }
  public onEscapePress = (e: KeyboardEvent) => {
    this.setState({target: null, shown: false});
  }
  private showModal = (target: HTMLElement) => {
    if (target === this.state.target) {
      this.setState({target: null, shown: false});
      return;
    }
    const post = getModel(target);
    let { left, top } = target.getBoundingClientRect();
    left += window.pageXOffset;
    top += window.pageYOffset + 20;
    this.setState({left, top, target, userId: post.name, shown: true});
  }
  private handleModalClick = (e: Event) => {
    e.stopPropagation();
  }
}

const IgnoreModal = EscapePressMixin(BackgroundClickMixin(IgnoreModalBase));

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

// Account login and registration.
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

  protected tabHook(id: number, el: Element) {
    if (el.classList.contains("account-identity-tab")) {
      el.innerHTML = "";
      render(<IdentityTab modal={this} />, el);
    }
  }

  // Create handler for dynamically loading and rendering conditional
  // view modules.
  private loadConditional(m: Constructable): EventListener {
    return () => {
      this.toggleContent(false);
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
  if (position > ModerationLevel.notLoggedIn) {
    const container = document.querySelector(MODAL_CONTAINER_SEL);
    if (container) {
      render(<IgnoreModal />, container);
      on(document, "click", (e) => {
        trigger(HOOKS.openIgnoreModal, e.target);
      }, {selector: TRIGGER_IGNORE_USER_SEL});
    }
  }
}
