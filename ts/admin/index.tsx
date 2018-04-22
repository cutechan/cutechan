/**
 * Admin page UI.
 *
 * @module cutechan/admin
 */

import { Component, h, render } from "preact";
import { _ } from "../lang";
import { BoardConfig } from "../state";
import { readableTime, relativeTime } from "../templates";
import { MAIN_CONTAINER_SEL } from "../vars";

interface AdminBoardConfig extends BoardConfig {
  modOnly?: boolean;
}

type ModBoards = AdminBoardConfig[];

const enum ModerationAction {
  banPost,
  unbanPost,
  deletePost,
  deleteImage,
  spoilerImage,
  deleteThread,
}

interface ModLogEntry {
  board: string;
  id: number;
  type: ModerationAction;
  by: string;
  created: number;
}

type ModLogEntries = ModLogEntry[];

declare global {
  interface Window {
    modBoards?: ModBoards;
    modLog?: ModLogEntries;
  }
}

export const modBoards = window.modBoards;
export const modLog = window.modLog;

function getBoardConfigByID(id: string): AdminBoardConfig {
  return modBoards.find((b) => b.id === id);
}

interface SettingsProps {
  board: string;
}

class Settings extends Component<SettingsProps, AdminBoardConfig> {
  constructor(props: SettingsProps) {
    super(props);
    this.state = {...getBoardConfigByID(props.board)};
  }
  public render({}, { title, readOnly, modOnly }: AdminBoardConfig) {
    return (
      <div class="settings">
        <a class="admin-content-anchor" name="settings" />
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
  board: string;
}

class Bans extends Component<BansProps, {}> {
  public render() {
    return (
      <div class="bans">
        <a class="admin-content-anchor" name="bans" />
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
  board: string;
}

class Log extends Component<LogProps, {}> {
  public shouldComponentUpdate(nextProps: LogProps) {
    return this.props.board !== nextProps.board;
  }
  public render({ board }: LogProps) {
    const log = modLog.filter((l) => l.board === board);
    return (
      <div class="log">
        <a class="admin-content-anchor" name="log" />
        <h3 class="admin-content-header">
          <a href="#log">{_("Mod log")}</a>
        </h3>
        <table class="log-list">
        <thead>
          <tr class="log-item-header">
            <th class="log-id-header">#</th>
            <th class="log-type-header">{_("Type")}</th>
            <th class="log-by-header">{_("By")}</th>
            <th class="log-time-header">{_("Date")}</th>
          </tr>
        </thead>
        <tbody>
        {log.map(({ id, type, by, created }) =>
          <tr class="log-item">
            <td class="log-id">
              <a class="post-link" href={`/all/${id}#${id}`}>
                &gt;&gt;{id}
              </a>
            </td>
            <td class="log-type">
              {this.renderType(type)}
            </td>
            <td class="log-by">{by}</td>
            <td class="log-time" title={readableTime(created)}>
              {relativeTime(created)}
            </td>
          </tr>,
        )}
        {!log.length &&
          <tr class="log-item">
            <td class="log-empty" colSpan={4}>{_("Empty log")}</td>
          </tr>
        }
        </tbody>
        </table>
      </div>
    );
  }
  private renderType(a: ModerationAction) {
    switch (a) {
    case ModerationAction.banPost:
      return <i class="fa fa-gavel" />;
    case ModerationAction.unbanPost:
      return (
        <span class="fa-stack">
          <i class="fa fa-gavel fa-stack-1x" />
          <i class="fa fa-ban fa-stack-2x log-ban-icon" />
        </span>
      );
    case ModerationAction.deletePost:
      return <i class="fa fa-trash" />;
    case ModerationAction.deleteImage:
      return null;
    case ModerationAction.spoilerImage:
      return null;
    case ModerationAction.deleteThread:
      return <i class="fa fa-2x fa-trash-o" />;
    }
  }
}

interface AdminState {
  board: string;
}

class Admin extends Component<{}, AdminState> {
  public state = {
    // User with access to admin page will have at least one board.
    board: modBoards[0].id,
  };
  public render({}, { board }: AdminState) {
    return (
      <section class="admin">
        <header class="admin-header">
          <h1 class="page-title">
            {_("Admin")}
            <select
              class="admin-board-select"
              value={board}
              onChange={this.handleBoardChange}
            >
              {modBoards.map((b) =>
                <option value={b.id}>/{b.id}/</option>,
              )}
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
            <Settings board={board} />
            <hr class="separator" />
            <Bans board={board} />
            <hr class="separator" />
            <Log board={board} />
          </section>
          <hr class="separator" />
        </section>
      </section>
    );
  }
  private handleBoardChange = (e: Event) => {
    const board = (e.target as HTMLInputElement).value;
    this.setState({board});
  }
}

export function init() {
  const container = document.querySelector(MAIN_CONTAINER_SEL);
  if (container) {
    render(<Admin />, container);
  }
}
