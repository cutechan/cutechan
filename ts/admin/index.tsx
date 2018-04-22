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

interface BanRecord {
  board: string;
  id: number;
  by: string;
  expires: number;
  reason: string;
}

type BanRecords = BanRecord[];

const enum ModerationAction {
  banPost,
  unbanPost,
  deletePost,
  deleteImage,
  spoilerImage,
  deleteThread,
}

interface ModLogRecord {
  board: string;
  id: number;
  type: ModerationAction;
  by: string;
  created: number;
}

type ModLogRecords = ModLogRecord[];

declare global {
  interface Window {
    modBoards?: ModBoards;
    bans?: BanRecords;
    modLog?: ModLogRecords;
  }
}

export const modBoards = window.modBoards;
export const bans = window.bans;
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
  public shouldComponentUpdate(nextProps: LogProps) {
    return this.props.board !== nextProps.board;
  }
  public render({ board }: LogProps) {
    const boardBans = bans.filter((b) => b.board === board);
    return (
      <div class="bans">
        <a class="admin-content-anchor" name="bans" />
        <h3 class="admin-content-header">
          <a href="#bans">{_("Bans")}</a>
        </h3>
        <table class="admin-table ban-list">
        <thead>
          <tr class="admin-table-header ban-item-header">
            <th class="ban-id-header">#</th>
            <th class="ban-reason-header">{_("Reason")}</th>
            <th class="ban-by-header">{_("By")}</th>
            <th class="ban-time-header">{_("Expires")}</th>
          </tr>
        </thead>
        <tbody>
        {boardBans.map(({ id, reason, by, expires }) =>
          <tr class="admin-table-item ban-item">
            <td class="ban-id">
              <a class="post-link" href={`/all/${id}#${id}`}>
                &gt;&gt;{id}
              </a>
            </td>
            <td class="ban-reason">{reason}</td>
            <td class="ban-by">{by}</td>
            <td class="ban-time" title={readableTime(expires)}>
              {relativeTime(expires)}
            </td>
          </tr>,
        )}
        {!boardBans.length &&
          <tr class="admin-table-empty ban-item">
            <td class="bans-empty" colSpan={4}>{_("No bans")}</td>
          </tr>
        }
        </tbody>
        </table>
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
    const boardLog = modLog.filter((l) => l.board === board);
    return (
      <div class="log">
        <a class="admin-content-anchor" name="log" />
        <h3 class="admin-content-header">
          <a href="#log">{_("Mod log")}</a>
        </h3>
        <table class="admin-table log-list">
        <thead>
          <tr class="admin-table-header log-item-header">
            <th class="log-id-header">#</th>
            <th class="log-type-header">{_("Type")}</th>
            <th class="log-by-header">{_("By")}</th>
            <th class="log-time-header">{_("Date")}</th>
          </tr>
        </thead>
        <tbody>
        {boardLog.map(({ id, type, by, created }) =>
          <tr class="admin-table-item log-item">
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
        {!boardLog.length &&
          <tr class="admin-table-empty log-item">
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
      return <i class="fa fa-gavel" title={_("ban")} />;
    case ModerationAction.unbanPost:
      return (
        <span class="fa-stack" title={_("unban")}>
          <i class="fa fa-gavel fa-stack-1x" />
          <i class="fa fa-ban fa-stack-2x log-ban-icon" />
        </span>
      );
    case ModerationAction.deletePost:
      return <i class="fa fa-trash" title={_("deletePost")} />;
    case ModerationAction.deleteImage:
      return null;
    case ModerationAction.spoilerImage:
      return null;
    case ModerationAction.deleteThread:
      return <i class="fa fa-2x fa-trash-o" title={_("deleteThread")} />;
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
        <section class="admin-inner">
          <ul class="admin-section-tabs">
            <li class="admin-section-tab">
              <a href="#settings">{_("Settings")}</a>
            </li>
            <li class="admin-section-tab">
              <a href="#members">{_("Members")}</a>
            </li>
            <li class="admin-section-tab">
              <a href="#bans">{_("Bans")}</a>
            </li>
            <li class="admin-section-tab">
              <a href="#log">{_("Mod log")}</a>
            </li>
          </ul>
          <hr class="admin-separator" />
          <section class="admin-content">
            <Settings board={board} />
            <hr class="admin-separator" />
            <Bans board={board} />
            <hr class="admin-separator" />
            <Log board={board} />
          </section>
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
