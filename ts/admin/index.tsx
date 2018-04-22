/**
 * Admin page UI.
 *
 * @module cutechan/admin
 */

import { Component, h, render } from "preact";
import { _ } from "../lang";
import { BoardConfig, boards } from "../state";
import { MAIN_CONTAINER_SEL } from "../vars";

// FIXME(Kagami): Get private board configs.
function getBoardByID(id: string): BoardConfig {
  return boards.find((b) => b.id === id);
}

interface SettingsProps {
  id: string;
}

interface AdminBoardConfig extends BoardConfig {
  modOnly?: boolean;
}

class Settings extends Component<SettingsProps, AdminBoardConfig> {
  constructor(props: SettingsProps) {
    super(props);
    this.state = {...getBoardByID(props.id), modOnly: false};
  }
  public render({}, { title, readOnly, modOnly }: AdminBoardConfig) {
    return (
      <div class="settings" id="settings">
        <h3 class="admin-content-header">
          <a href="#settings">{_("Settings")}</a>
        </h3>
        <label class="settings-label">
          <span class="settings-text">{_("Title")}</span>
          <input
            class="settings-input"
            value={title}
            onInput={this.handleTitleChange}
          />
        </label>
        <label class="settings-label">
          <span class="settings-text">{_("Read only")}</span>
          <input
            class="settings-checkbox"
            type="checkbox"
            checked={readOnly}
            onChange={this.handleReadOnlyToggle}
          />
        </label>
        <label class="settings-label">
          <span class="settings-text">{_("Mod only")}</span>
          <input
            class="settings-checkbox"
            type="checkbox"
            checked={modOnly}
            onChange={this.handleModOnlyToggle}
          />
        </label>
      </div>
    );
  }
  private handleTitleChange = (e: Event) => {
    const title = (e.target as HTMLInputElement).value;
    this.setState({title});
  }
  private handleReadOnlyToggle = (e: Event) => {
    e.preventDefault();
    const readOnly = !this.state.readOnly;
    this.setState({readOnly});
  }
  private handleModOnlyToggle = (e: Event) => {
    e.preventDefault();
    const modOnly = !this.state.modOnly;
    this.setState({modOnly});
  }
}

interface BansProps {
  id: string;
}

class Bans extends Component<BansProps, {}> {
  public render() {
    return (
      <div class="bans" id="bans">
        <h3 class="admin-content-header">
          <a href="#bans">{_("Bans")}</a>
        </h3>
        <ul class="ban-list">
          <li class="ban2">
            127.0.0.1/32
            <button class="control admin-control">
              <i class="fa fa-times-circle" />
            </button>
          </li>
          <li class="ban2">
            127.0.0.1/32
            <button class="control admin-control">
              <i class="fa fa-times-circle" />
            </button>
          </li>
          <li class="ban2">
            127.0.0.1/32
            <button class="control admin-control">
              <i class="fa fa-times-circle" />
            </button>
          </li>
          <li class="ban2">
            127.0.0.1/32
            <button class="control admin-control">
              <i class="fa fa-times-circle" />
            </button>
          </li>
          <li class="ban2">
            127.0.0.1/32
            <button class="control admin-control">
              <i class="fa fa-times-circle" />
            </button>
          </li>
        </ul>
      </div>
    );
  }
}

interface LogProps {
  id: string;
}

class Log extends Component<LogProps, {}> {
  public render() {
    return (
      <div class="log" id="log">
        <h3 class="admin-content-header">
          <a href="#log">{_("Mod log")}</a>
        </h3>
        <ul class="log-list">
          <li class="log-item">
          </li>
        </ul>
      </div>
    );
  }
}

class Admin extends Component<{}, {}> {
  public render() {
    return (
      <section class="admin">
        <header class="admin-header">
          <h1 class="page-title">
            {_("Admin")}
            <select class="admin-board-select">
              <option>/b/</option>
            </select>
          </h1>
        </header>
        <hr class="separator" />
        <section class="admin-inner">
          <ul class="admin-section-tabs">
            <li class="admin-section-tab">
              <a href="#settings">{_("Settings")}</a>
            </li>
            <li class="admin-section-tab">
              <a href="#bans">{_("Bans")}</a>
            </li>
            <li class="admin-section-tab">
              <a href="#members">{_("Members")}</a>
            </li>
            <li class="admin-section-tab">
              <a href="#log">{_("Mod log")}</a>
            </li>
          </ul>
          <hr class="separator" />
          <section class="admin-content">
            <Settings id="b" />
            <hr class="separator" />
            <Bans id="b" />
            <hr class="separator" />
            <Log id="b" />
          </section>
        </section>
      </section>
    );
  }
}

export function init() {
  const container = document.querySelector(MAIN_CONTAINER_SEL);
  if (container) {
    render(<Admin />, container);
  }
}
