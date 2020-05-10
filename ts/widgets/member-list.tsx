/**
 * Member list widget.
 */

import cx from "classnames";
import { Component, h } from "preact";
import { session } from "../auth";
import _ from "../lang";

interface MemberListProps {
  members: string[];
  disabled?: boolean;
  onChange: (members: string[]) => void;
}

class MemberList extends Component<MemberListProps, {}> {
  public shouldComponentUpdate(nextProps: MemberListProps) {
    return this.props.members !== nextProps.members;
  }
  public render({ members, disabled }: MemberListProps) {
    return (
      <ul class={cx("member-list", disabled && "member-list_disabled")}>
        {members.map((name) => (
          <li key={name} class="member-list-item">
            <span
              class="member-list-name"
              onClick={() => this.handleRemove(name)}
            >
              {name}
            </span>
          </li>
        ))}
        <li class="member-list-newitem">
          <input
            class="member-list-input"
            placeholder={_("Add name")}
            maxLength={20}
            title={_("Enter to add")}
            disabled={disabled}
            onKeyDown={this.handleNameKey}
          />
        </li>
      </ul>
    );
  }
  private isValid(name: string): boolean {
    // TODO(Kagami): Validate name chars and highlight invalid inputs?
    return (
      name.length >= 1 &&
      name !== session.userID &&
      !this.props.members.includes(name)
    );
  }
  private handleRemove = (name: string) => {
    if (this.props.disabled) return;
    if (name === session.userID) return;
    const members = this.props.members.filter((n) => n !== name);
    this.props.onChange(members);
  };
  private handleNameKey = (e: KeyboardEvent) => {
    if (e.keyCode === 13) {
      const nameEl = e.target as HTMLInputElement;
      const name = nameEl.value.trim();
      if (!this.isValid(name)) return;
      const members = this.props.members.concat(name);
      this.props.onChange(members);
      nameEl.value = "";
    }
  };
}

export default MemberList;
