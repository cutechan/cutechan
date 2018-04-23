/**
 * Authorized actions handling.
 *
 * @module cutechan/auth
 */

import * as cx from "classnames";
import { Component, h, render } from "preact";
import { showAlert, showSendAlert } from "../alerts";
import API from "../api";
import { TabbedModal } from "../base";
import { _ } from "../lang";
import { Post } from "../posts";
import { getModel, page } from "../state";
import {
  BackgroundClickMixin, Constructable, EscapePressMixin,
  hook, HOOKS, on, remove, trigger, unhook,
} from "../util";
import {
  MODAL_CONTAINER_SEL, TRIGGER_BAN_BY_POST_SEL,
  TRIGGER_DELETE_POST_SEL, TRIGGER_IGNORE_USER_SEL,
} from "../vars";
import { MemberList } from "../widgets";
import { BoardCreationForm } from "./board-form";
import { LoginForm, validatePasswordMatch } from "./login-form";
import { PasswordChangeForm } from "./password-form";
import { ServerConfigForm } from "./server-form";

export const enum ModerationLevel {
  notLoggedIn = - 1,
  notStaff,
  janitor,
  moderator,
  boardOwner,
  admin,
}

export const enum IgnoreMode {
  disabled = -1,
  byBlacklist,
  byWhitelist,
}

export interface Session {
  userID: string;
  positions: Positions;
  settings: AccountSettings;
}

export interface Positions {
  curBoard: ModerationLevel;
  anyBoard: ModerationLevel;
}

export interface AccountSettings {
  name?: string;
  showName?: boolean;
  ignoreMode?: IgnoreMode;
  includeAnon?: boolean;
  whitelist?: string[];
  blacklist?: string[];
}

declare global {
  interface Window {
    session?: Session;
  }
}

export const session = window.session;
export const account = session ? session.settings : {};
account.ignoreMode = account.ignoreMode || 0;
account.whitelist = account.whitelist || [];
account.blacklist = account.blacklist || [];
export const position = session ? session.positions.curBoard : ModerationLevel.notLoggedIn;
export const anyposition = session ? session.positions.curBoard : ModerationLevel.notLoggedIn;

export function isModerator(): boolean {
  return position >= ModerationLevel.moderator;
}

export function isPowerUser(): boolean {
  return anyposition >= ModerationLevel.janitor;
}

interface IdentityProps {
  modal: AccountPanel;
}

interface IdentityState extends AccountSettings {
  saving: boolean;
}

class IdentityTab extends Component<IdentityProps, IdentityState> {
  public state = {
    ...account,
    whitelist: account.whitelist.slice(),
    blacklist: account.blacklist.slice(),
    saving: false,
  };
  public render({}, {
    name, showName, ignoreMode, includeAnon, whitelist, blacklist,
    saving,
  }: IdentityState) {
    return (
      <div class="account-identity-tab-inner">
        <article class="account-form-section">
          <h3 class="account-form-shead">
            {_("Show name")}
          </h3>
          <div class="account-form-sbody">
            <input
              class="account-form-checkbox option-checkbox"
              type="checkbox"
              checked={showName}
              disabled={saving}
              onChange={this.handleShowNameToggle}
            />
            <input
              class="account-form-name"
              type="text"
              placeholder={_("Name")}
              value={name}
              disabled={saving}
              onChange={this.handleNameChange}
            />
          </div>
        </article>
        <article class="account-form-section">
          <h3 class="account-form-shead">
            {_("Ignore mode")}
          </h3>
          <div class="account-form-sbody">
            <select
              class="account-form-ignoremode option-select"
              value={ignoreMode.toString()}
              disabled={saving}
              onChange={this.handleIgnoreModeChange}
            >
              <option value={IgnoreMode.disabled.toString()}>
                {_("No ignore")}
              </option>
              <option value={IgnoreMode.byBlacklist.toString()}>
                {_("Hide blacklisted")}
              </option>
              <option value={IgnoreMode.byWhitelist.toString()}>
                {_("Show whitelisted")}
              </option>
            </select>
          </div>
        </article>
        <article class="account-form-section account-form-section_row">
          <article class="account-form-section">
            <h3 class="account-form-shead">{_("Whitelist")}</h3>
            <MemberList
              members={whitelist}
              disabled={saving}
              onChange={this.handleWhitelistChange}
            />
          </article>
          <article class="account-form-section">
            <h3 class="account-form-shead">
              {_("Blacklist")}
            </h3>
            <MemberList
              members={blacklist}
              disabled={saving}
              onChange={this.handleBlacklistChange}
            />
          </article>
        </article>
        <article class="account-form-section">
          <div class="account-form-sbody">
            <label class={cx("option-label", saving && "option-label_disabled")}>
              <input
                class="account-form-checkbox option-checkbox"
                type="checkbox"
                checked={includeAnon}
                disabled={saving}
                onChange={this.handleIncludeAnonToggle}
              />
              {_("Including anonymous")}
            </label>
          </div>
        </article>
        <button class="button account-save-button" disabled={saving} onClick={this.handleSave}>
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
    // TODO(Kagami): Validate name properly.
    const name = (e.target as HTMLInputElement).value;
    this.setState({name});
  }
  private handleIgnoreModeChange = (e: Event) => {
    const ignoreMode = +(e.target as HTMLInputElement).value;
    this.setState({ignoreMode});
  }
  private handleWhitelistChange = (whitelist: string[]) => {
    this.setState({whitelist});
  }
  private handleBlacklistChange = (blacklist: string[]) => {
    this.setState({blacklist});
  }
  private handleIncludeAnonToggle = (e: Event) => {
    e.preventDefault();
    const includeAnon = !this.state.includeAnon;
    this.setState({includeAnon});
  }
  private handleSave = () => {
    const s = this.state;
    const settings = {
      ...account,
      name: s.name,
      showName: s.showName,
      ignoreMode: s.ignoreMode,
      includeAnon: s.includeAnon,
      whitelist: s.whitelist,
      blacklist: s.blacklist,
    };
    this.setState({saving: true});
    API.account.setSettings(settings)
      .then(() => {
        Object.assign(account, settings);
        this.props.modal.hide();
      }, showSendAlert)
      .then(() => {
        this.setState({saving: false});
      });
  }
}

interface IgnoreState {
  target?: Element;
  shown: boolean;
  left: number;
  top: number;
  userID: string;
  savingWL: boolean;
  savingBL: boolean;
  whitelist: string[];
  blacklist: string[];
}

class IgnoreModalBase extends Component<{}, IgnoreState> {
  public state: IgnoreState = {
    target: null,
    shown: false,
    left: 0,
    top: 0,
    userID: "",
    savingWL: false,
    savingBL: false,
    whitelist: [],
    blacklist: [],
  };
  public get saving() {
    return this.state.savingWL || this.state.savingBL;
  }
  public get wled() {
    return this.state.whitelist.includes(this.state.userID);
  }
  public get bled() {
    return this.state.blacklist.includes(this.state.userID);
  }
  public componentDidMount() {
    hook(HOOKS.openIgnoreModal, this.show);
  }
  public componentWillUnmount() {
    unhook(HOOKS.openIgnoreModal, this.show);
  }
  public render({}, { shown, left, top, userID, savingWL, savingBL }: IgnoreState) {
    if (!shown) return null;
    const style = {left, top};
    return (
      <div
        class={cx("ignore-modal", {
          "ignore-modal_saving": this.saving,
          "ignore-modal_wled": this.wled,
          "ignore-modal_bled": this.bled,
        })}
        style={style}
        onClick={this.handleModalClick}
      >
        <div class="ignore-modal-info">
          {userID}
        </div>
        <div class="ignore-modal-item" onClick={this.addToWhitelist}>
          <i class={cx("ignore-save-icon control fa", {
            "fa-spinner fa-pulse fa-fw": savingWL,
            "fa-check-circle": !savingWL,
          })} />
          <span> {_(this.wled ? "From whitelist" : "To whitelist")}</span>
        </div>
        <div class="ignore-modal-item" onClick={this.addToBlacklist}>
          <i class={cx("ignore-save-icon control fa", {
            "fa-spinner fa-pulse fa-fw": savingBL,
            "fa-times-circle": !savingBL,
          })} />
          <span> {_(this.bled ? "From blacklist" : "To blacklist")}</span>
        </div>
      </div>
    );
  }
  public onBackgroundClick = (e: MouseEvent) => {
    if (e.target === this.state.target) return;
    if (this.state.shown) {
      this.hide();
    }
  }
  public onEscapePress = (e: KeyboardEvent) => {
    this.hide();
  }
  private show = (target: Element) => {
    if (target === this.state.target) {
      this.hide();
      return;
    }
    const post = getModel(target);
    if (post.userID === session.userID) return;
    let { left, top } = target.getBoundingClientRect();
    left += window.pageXOffset;
    top += window.pageYOffset + 20;
    this.setState({
      shown: true,
      target, left, top,
      userID: post.userID,
      whitelist: account.whitelist.slice(),
      blacklist: account.blacklist.slice(),
    });
  }
  private hide = () => {
    if (this.saving) return;
    this.setState({target: null, shown: false});
  }
  private handleModalClick = (e: Event) => {
    e.stopPropagation();
  }
  private addToWhitelist = () => {
    if (this.saving) return;
    const { userID, whitelist, blacklist } = this.state;
    if (this.wled) {
      remove(whitelist, userID);
    } else {
      remove(blacklist, userID);
      whitelist.push(userID);
    }
    const settings = {...account, whitelist, blacklist};
    this.setState({savingWL: true});
    API.account.setSettings(settings)
      .then(() => {
        Object.assign(account, settings);
        this.setState({savingWL: false}, this.hide);
      }, (err) => {
        showSendAlert(err);
        this.setState({savingWL: false});
      });
  }
  private addToBlacklist = () => {
    if (this.saving) return;
    const { userID, whitelist, blacklist } = this.state;
    if (this.bled) {
      remove(blacklist, userID);
    } else {
      remove(whitelist, userID);
      blacklist.push(userID);
    }
    const settings = {...account, whitelist, blacklist};
    this.setState({savingBL: true});
    API.account.setSettings(settings)
      .then(() => {
        Object.assign(account, settings);
        this.setState({savingBL: false}, this.hide);
      }, (err) => {
        showSendAlert(err);
        this.setState({savingBL: false});
      });
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
      "#configureServer": this.loadConditional(ServerConfigForm),
    });
  }

  protected tabHook(el: Element) {
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

function getModelByEvent(e: Event): Post {
  return getModel(e.target as Element);
}

function deletePost(post: Post, force?: boolean) {
  if (!force && !confirm(_("delConfirm"))) return;
  API.post.delete([post.id]).then(() => {
    // In thread we should delete on WebSocket event.
    if (!page.thread) {
      post.setDeleted();
    }
  }, showAlert);
}

function banUser(post: Post) {
  if (!confirm(_("banConfirm"))) return;
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
  if (position >= ModerationLevel.moderator) {
    on(document, "click", (e) => {
      deletePost(getModelByEvent(e));
    }, {selector: TRIGGER_DELETE_POST_SEL});

    on(document, "click", (e) => {
      banUser(getModelByEvent(e));
    }, {selector: TRIGGER_BAN_BY_POST_SEL});
  }
}
