/**
 * Working with idol profiles.
 *
 * @module cutechan/idols/profiles
 */

import { Component, h, render } from "preact";
import {
  Band, BandMap, getBandMap, getIdolPreviewUrl,
  getProfiles, Idol, Profiles,
  renderIdol, searchIdols,
} from "../../go/src/github.com/Kagami/kpopnet/ts/api";
import { _ } from "../lang";
import { getFilePrefix } from "../posts";
import { hook, HOOKS } from "../util";
import { PROFILES_CONTAINER_SEL } from "../vars";

interface ItemProps {
  idol: Idol;
  band: Band;
}

class IdolItem extends Component<ItemProps, any> {
  public shouldComponentUpdate() {
    return false;
  }
  public render({ idol, band }: ItemProps) {
    const opts = {small: true, prefix: getFilePrefix()};
    const previewUrl = getIdolPreviewUrl(idol, opts);
    const style = {backgroundImage: `url(${previewUrl})`};
    const lines = renderIdol(idol, band).slice(0, 5);
    return (
      <section class="idol">
        <div
          class="idol-preview"
          style={style}
        />
        <div class="idol-info">
          {lines.map(([key, val]) =>
            <p class="idol-info-line">
              <span class="idol-info-key">{_(key)}: </span>
              <span class="idol-info-val">{val}</span>
            </p>,
          )}
        </div>
      </section>
    );
  }
}

interface ListProps {
  profiles: Profiles;
  bandMap: BandMap;
  query: string;
}

class IdolList extends Component<ListProps, any> {
  public shouldComponentUpdate(nextProps: ListProps) {
    return this.props.query !== nextProps.query;
  }
  public render({ query, profiles, bandMap }: ListProps) {
    const idols = searchIdols(query, profiles, bandMap).slice(0, 20);
    return (
      <article class="idols">
        {idols.map((idol) =>
          <IdolItem
            key={idol.id}
            idol={idol}
            band={bandMap.get(idol.band_id).band}
          />,
        )}
      </article>
    );
  }
}

function Spinner() {
  return (
    <i class="header-profiles-spinner fa fa-spinner fa-pulse fa-fw"></i>
  );
}

interface WrapperState {
  loading: boolean;
  query: string;
}

class ProfilesWrapper extends Component<any, WrapperState> {
  private profiles: Profiles = null;
  private bandMap: BandMap = null;
  private inputEl: HTMLInputElement = null;
  constructor() {
    super();
    this.state = {
      loading: false,
      query: "",
    };
  }
  public componentDidUpdate(prevProps: any, prevState: WrapperState) {
    if (prevState.loading && !this.state.loading) {
      this.inputEl.focus();
    }
  }
  public render(props: any, { loading, query }: WrapperState) {
    return (
      <span class="header-profiles-wrapper">
        <input
          ref={(i) => this.inputEl = i as HTMLInputElement}
          class="header-profiles-search"
          placeholder={_("searchIdol")}
          disabled={loading}
          onFocus={this.handleFocus}
          onInput={this.handleChange}
        />
        {loading && <Spinner/>}
        <IdolList
          profiles={this.profiles}
          bandMap={this.bandMap}
          query={query}
        />
      </span>
    );
  }
  private handleFocus = () => {
    // Lazy load profiles to avoid extra request on page load.
    // Should we fetch them automatically after 5-10s?
    if (!this.profiles) {
      this.setState({loading: true});
      getProfiles().then((profiles) => {
        this.profiles = profiles;
        this.bandMap = getBandMap(profiles);
        this.setState({loading: false});
      });
    }
  }
  private handleChange = () => {
    const query = this.inputEl.value;
    this.setState({query});
  }
}

export function init() {
  const container = document.querySelector(PROFILES_CONTAINER_SEL);
  if (container) {
    // Server-side template renders exactly same search input in order
    // to make preact's kick off seamless.
    container.innerHTML = "";
    render(<ProfilesWrapper/>, container);

    hook(HOOKS.focusSearch, () => {
      document.querySelector(".header-profiles-search").focus();
    });
  }
}
