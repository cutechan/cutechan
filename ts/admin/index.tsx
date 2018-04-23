/**
 * Admin page UI.
 *
 * @module cutechan/admin
 */

import * as cx from "classnames";
import { Component, h, render } from "preact";
import { ModerationLevel } from "../auth";
import { _ } from "../lang";
import { BoardConfig } from "../state";
import { readableTime, relativeTime } from "../templates";
import { MAIN_CONTAINER_SEL } from "../vars";
import { MemberList } from "../widgets";

export const enum AccessMode {
  bypass = -1,
  viaBlacklist,
  viaWhitelist,
}

interface AdminBoardConfig extends BoardConfig {
  modOnly?: boolean;
  accessMode?: AccessMode;
  includeAnon?: boolean;
}

type ModBoards = AdminBoardConfig[];

interface StaffRecord {
  board: string;
  userID: string;
  position: ModerationLevel;
}

type Staff = StaffRecord[];

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
    modStaff?: Staff;
    modBans?: BanRecords;
    modLog?: ModLogRecords;
  }
}

export const modBoards = window.modBoards;
export const modStaff = window.modStaff;
export const modBans = window.modBans;
export const modLog = window.modLog;

type ChangeFn = (changes: BoardStateChanges) => void;

interface SettingsProps {
  settings: AdminBoardConfig;
  onChange: ChangeFn;
}

class Settings extends Component<SettingsProps, {}> {
  public shouldComponentUpdate(nextProps: SettingsProps) {
    return this.props.settings !== nextProps.settings;
  }
  public render({ settings }: SettingsProps) {
    const { title, readOnly, modOnly, accessMode, includeAnon } = settings;
    return (
      <div class="settings">
        <a class="admin-content-anchor" name="settings" />
        <h3 class="admin-content-header">
          <a class="admin-header-link" href="#settings">{_("Settings")}</a>
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
          <span class="settings-text">{_("Access mode")}</span>
          <select
            class="settings-select"
            value={(accessMode || 0).toString()}
            onChange={this.handleAccessModeChange}
          >
            <option value={AccessMode.bypass.toString()}>
              {_("Bypass")}
            </option>
            <option value={AccessMode.viaBlacklist.toString()}>
              {_("Deny blacklisted")}
            </option>
            <option value={AccessMode.viaWhitelist.toString()}>
              {_("Allow whitelisted")}
            </option>
          </select>
        </label>
        <label class="settings-label">
          <span class="settings-text">{_("Including anonymous")}</span>
          <input
            class="settings-checkbox"
            type="checkbox"
            checked={includeAnon}
            onChange={this.handleIncludeAnonToggle}
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
    const settings = {...this.props.settings, title};
    this.props.onChange({settings});
  }
  private handleReadOnlyToggle = (e: Event) => {
    e.preventDefault();
    const readOnly = !this.props.settings.readOnly;
    const settings = {...this.props.settings, readOnly};
    this.props.onChange({settings});
  }
  private handleModOnlyToggle = (e: Event) => {
    e.preventDefault();
    const modOnly = !this.props.settings.modOnly;
    const settings = {...this.props.settings, modOnly};
    this.props.onChange({settings});
  }
  private handleAccessModeChange = (e: Event) => {
    const accessMode = +(e.target as HTMLInputElement).value;
    const settings = {...this.props.settings, accessMode};
    this.props.onChange({settings});
  }
  private handleIncludeAnonToggle = (e: Event) => {
    e.preventDefault();
    const includeAnon = !this.props.settings.includeAnon;
    const settings = {...this.props.settings, includeAnon};
    this.props.onChange({settings});
  }
}

interface MembersProps {
  board: string;
  staff: Staff;
  onChange: ChangeFn;
}

class Members extends Component<MembersProps, {}> {
  public shouldComponentUpdate(nextProps: MembersProps) {
    return this.props.staff !== nextProps.staff;
  }
  public render() {
    return (
      <div class="admin-members">
        <a class="admin-content-anchor" name="members" />
        <h3 class="admin-content-header">
          <a class="admin-header-link" href="#members">{_("Members")}</a>
        </h3>
        <div class="admin-members-grid">
          <div class="admin-owners">
            <h3 class="admin-members-shead">{_("Owners")}</h3>
            <MemberList
              members={this.getStaff(ModerationLevel.boardOwner)}
              onChange={this.handleOwnersChange}
            />
          </div>
          <div class="admin-moderators">
            <h3 class="admin-members-shead">{_("Moderators")}</h3>
            <MemberList
              members={this.getStaff(ModerationLevel.moderator)}
              onChange={this.handleModeratorsChange}
            />
          </div>
          <div class="admin-janitors">
            <h3 class="admin-members-shead">{_("Janitors")}</h3>
            <MemberList
              members={this.getStaff(ModerationLevel.janitor)}
              onChange={this.handleJanitorsChange}
            />
          </div>
          <div class="admin-whitelist">
            <h3 class="admin-members-shead">{_("Whitelist")}</h3>
            <MemberList
              members={this.getStaff(ModerationLevel.whitelisted)}
              onChange={this.handleWhitelistChange}
            />
          </div>
          <div class="admin-blacklist">
            <h3 class="admin-members-shead">{_("Blacklist")}</h3>
            <MemberList
              members={this.getStaff(ModerationLevel.blacklisted)}
              onChange={this.handleBlacklistChange}
            />
          </div>
        </div>
      </div>
    );
  }
  private getStaff(position: ModerationLevel) {
    return this.props.staff
      .filter((s) => s.position === position)
      .map((s) => s.userID);
  }
  private setStaff(position: ModerationLevel, names: string[]) {
    const board = this.props.board;
    const staff = this.props.staff.filter((s) => s.position !== position);
    const newStaff = names.map((userID) => ({board, userID, position}));
    return staff.concat(newStaff);
  }
  private handleOwnersChange = (owners: string[]) => {
    const staff = this.setStaff(ModerationLevel.boardOwner, owners);
    this.props.onChange({staff});
  }
  private handleModeratorsChange = (moderators: string[]) => {
    const staff = this.setStaff(ModerationLevel.moderator, moderators);
    this.props.onChange({staff});
  }
  private handleJanitorsChange = (janitors: string[]) => {
    const staff = this.setStaff(ModerationLevel.janitor, janitors);
    this.props.onChange({staff});
  }
  private handleWhitelistChange = (whitelist: string[]) => {
    const staff = this.setStaff(ModerationLevel.whitelisted, whitelist);
    this.props.onChange({staff});
  }
  private handleBlacklistChange = (blacklist: string[]) => {
    const staff = this.setStaff(ModerationLevel.blacklisted, blacklist);
    this.props.onChange({staff});
  }
}

interface BansProps {
  bans: BanRecords;
  onChange: ChangeFn;
}

class Bans extends Component<BansProps, {}> {
  public shouldComponentUpdate(nextProps: BansProps) {
    return this.props.bans !== nextProps.bans;
  }
  public render({ bans }: BansProps) {
    return (
      <div class="bans">
        <a class="admin-content-anchor" name="bans" />
        <h3 class="admin-content-header">
          <a class="admin-header-link" href="#bans">{_("Bans")}</a>
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
        {bans.map(({ id, reason, by, expires }) =>
          <tr class="admin-table-item ban-item" onClick={() => this.handleRemove(id)}>
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
        {!bans.length &&
          <tr class="admin-table-empty">
            <td class="bans-empty" colSpan={4}>{_("No bans")}</td>
          </tr>
        }
        </tbody>
        </table>
      </div>
    );
  }
  private handleRemove(id: number) {
    const bans = this.props.bans.filter((b) => b.id !== id);
    this.props.onChange({bans});
  }
}

interface LogProps {
  log: ModLogRecords;
}

class Log extends Component<LogProps, {}> {
  public shouldComponentUpdate(nextProps: LogProps) {
    return this.props.log !== nextProps.log;
  }
  public render({ log }: LogProps) {
    return (
      <div class="log">
        <a class="admin-content-anchor" name="log" />
        <h3 class="admin-content-header">
          <a class="admin-header-link" href="#log">{_("Mod log")}</a>
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
        {log.map(({ id, type, by, created }) =>
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
        {!log.length &&
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

interface BoardState {
  settings: AdminBoardConfig;
  staff: Staff;
  bans: BanRecords;
  log: ModLogRecords;
}

interface BoardStateChanges {
  settings?: AdminBoardConfig;
  staff?: Staff;
  bans?: BanRecords;
}

interface AdminState {
  id: string;
  boardState: BoardState;
  needSaving: boolean;
  saving: boolean;
}

class Admin extends Component<{}, AdminState> {
  constructor() {
    super();
    // User with access to admin page will have at least one board.
    const { id } = modBoards[0];
    this.state = {
      id,
      boardState: this.getBoardState(id),
      needSaving: false,
      saving: false,
    };
  }
  public render({}, { id, boardState, needSaving, saving }: AdminState) {
    const { settings, staff, bans, log } = boardState;
    return (
      <section class="admin">
        <header class="admin-header">
          <h1 class="page-title">
            {_("Admin")}
            <select
              class="admin-board-select"
              value={boardState.settings.id}
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
            <Settings settings={settings} onChange={this.handleChange} />
            <hr class="admin-separator" />
            <Members board={id} staff={staff} onChange={this.handleChange} />
            <hr class="admin-separator" />
            <Bans bans={bans} onChange={this.handleChange} />
            <hr class="admin-separator" />
            <Log log={log} />
          </section>
        </section>
        <footer class={cx("admin-footer", needSaving && "admin-footer_visible")}>
          <button
            class="button admin-button admin-save-button"
            onClick={this.handleSave}
          >
            <i class={cx("admin-icon admin-save-icon fa", {
              "fa-spinner fa-pulse fa-fw": saving,
              "fa-check-circle": !saving,
            })} />
            {_("Save")}
          </button>
          <button
            class="button admin-button admin-cancel-button"
            onClick={this.handleReset}
          >
            <i class="admin-icon admin-reset-icon fa fa-times-circle" />
            {_("Reset")}
          </button>
        </footer>
      </section>
    );
  }
  private getBoardState(id: string) {
    const board = modBoards.find((b) => b.id === id);
    return {
      settings: {...board},
      staff: modStaff.filter((b) => b.board === id),
      bans: modBans.filter((b) => b.board === id),
      log: modLog.filter((l) => l.board === id),
    };
  }
  private handleBoardChange = (e: Event) => {
    const id = (e.target as HTMLInputElement).value;
    const boardState = this.getBoardState(id);
    this.setState({id, boardState});
  }
  private handleChange = (changes: BoardStateChanges) => {
    const boardState = Object.assign({}, this.state.boardState, changes);
    this.setState({boardState, needSaving: true});
  }
  private handleSave = () => {
    this.setState({needSaving: false});
  }
  private handleReset = () => {
    const boardState = this.getBoardState(this.state.id);
    this.setState({boardState, needSaving: false});
  }
}

export function init() {
  const container = document.querySelector(MAIN_CONTAINER_SEL);
  if (container) {
    render(<Admin />, container);
  }
}
