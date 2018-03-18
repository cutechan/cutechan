/**
 * Working with idol profiles.
 *
 * @module cutechan/idols/profiles
 */

import { Component, h, render } from "preact";
import {
  getProfiles, Profiles,
} from "../../go/src/github.com/Kagami/kpopnet/ts/api";
import Spinner from "../spinner";
import { hook, HOOKS } from "../util";
import { PROFILES_CONTAINER_SEL } from "../vars";

interface ProfilesWrapperState {
  loading: boolean;
}

class ProfilesWrapper extends Component<any, ProfilesWrapperState> {
  private profiles: Profiles = null;
  private inputEl: HTMLInputElement = null;
  constructor() {
    super();
    this.state = {
      loading: false,
    };
  }
  public componentDidUpdate(prevProps: any, prevState: ProfilesWrapperState) {
    if (prevState.loading && !this.state.loading) {
      this.inputEl.focus();
    }
  }
  public render(props: any, { loading }: ProfilesWrapperState) {
    return (
      <span class="header-profiles-wrapper">
        <input
          ref={(i) => this.inputEl = i as HTMLInputElement}
          class="header-profiles-search"
          disabled={loading}
          onFocus={this.handleFocus}
        />
        {loading && <Spinner/>}
      </span>
    );
  }
  private handleFocus = () => {
    if (!this.profiles) {
      this.setState({loading: true});
      getProfiles().then((profiles) => {
        this.profiles = profiles;
        this.setState({loading: false});
      });
    }
  }
}

export function init() {
  const container = document.querySelector(PROFILES_CONTAINER_SEL);
  if (container) {
    // Server-side template draws exactly same search input in order to
    // make preact's kick off seamless.
    container.innerHTML = "";
    render(<ProfilesWrapper/>, container);

    hook(HOOKS.focusSearch, () => {
      document.querySelector(".header-profiles-search").focus();
    });
  }
}
