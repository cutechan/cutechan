/**
 * Working with idol profiles.
 *
 * @module cutechan/idols/profiles
 */

import { Component, h, render } from "preact";
import * as ruhangul from "ruhangul";
import {
  BandMap, getBandMap, getIdolPreviewUrl,
  getProfiles, Idol, ImageIdData,
  Profiles, RenderedLine, renderIdol,
  searchIdols, setIdolPreview,
} from "../../go/src/github.com/Kagami/kpopnet/ts/api";
import { showAlert } from "../alerts";
import { _, printf } from "../lang";
import { isPowerUser } from "../mod";
import { getFilePrefix } from "../posts";
import { hook, HOOKS } from "../util";
import { PROFILES_CONTAINER_SEL } from "../vars";

interface PreviewProps {
  idol: Idol;
  onChange: (idol: Idol, imageId: string) => void;
}

class IdolPreview extends Component<PreviewProps, any> {
  private fileEl: HTMLInputElement = null;
  public render({ idol }: PreviewProps) {
    const opts = {small: true, prefix: getFilePrefix()};
    const previewUrl = getIdolPreviewUrl(idol, opts);
    const style = {backgroundImage: `url(${previewUrl})`};
    return (
      <div
        class="idol-preview"
        style={style}
        onClick={this.handlePreviewClick}
      >
        <input
          ref={(f) => this.fileEl = f as HTMLInputElement}
          type="file"
          accept="image/jpeg"
          class="idol-preview-file"
          onChange={this.handleFileChange}
        />
      </div>
    );
  }
  private handlePreviewClick = () => {
    if (isPowerUser()) {
      this.fileEl.click();
    }
  }
  private handleFileChange = () => {
    const files = this.fileEl.files;
    if (files.length) {
      this.handleFile(files[0]);
    }
    this.fileEl.value = "";  // Allow to select same file again
  }
  private handleFile(file: File) {
    const { idol } = this.props;
    setIdolPreview(idol, file).then(({ SHA1 }: ImageIdData) => {
      this.props.onChange(idol, SHA1);
    }).catch(showAlert);
  }
}

interface ItemProps {
  idol: Idol;
  bandMap: BandMap;
}

class IdolItem extends Component<ItemProps, any> {
  public shouldComponentUpdate() {
    return false;
  }
  public render({ idol, bandMap }: ItemProps) {
    // FIXME(Kagami): Show all info on request.
    const lines = renderIdol(idol, bandMap).slice(0, 5);
    return (
      <section class="idol">
        <IdolPreview idol={idol} onChange={this.handlePreviewChange} />
        <div class="idol-info">
          {lines.map(this.rerenderLine.bind(this, idol))}
        </div>
      </section>
    );
  }
  private rerenderLine(idol: Idol, [key, val]: RenderedLine) {
    // XXX(Kagami): Fix result of kpopnet example render the way we
    // need. This is a bit hacky, maybe it would be better to implement
    // everything by ourself.
    let ru = "";
    switch (key) {
    case "Name":
      if (!idol.name_hangul) break;
      ru = ruhangul.name(idol.name_hangul);
      if (!ru) break;
      return (
        <p class="idol-info-line">
          <span class="idol-info-key">{_(key)}</span>
          <span class="idol-info-val">
            {idol.name} (
            <abbr class="idol-info-abbr" title={ru}>
              {idol.name_hangul}
            </abbr>)
          </span>
        </p>
      );
    case "Real name":
      if (!idol.birth_name_hangul) break;
      ru = ruhangul.name(idol.birth_name_hangul);
      if (!ru) break;
      return (
        <p class="idol-info-line">
          <span class="idol-info-key">{_(key)}</span>
          <span class="idol-info-val">
            {idol.birth_name} (
            <abbr class="idol-info-abbr" title={ru}>
              {idol.birth_name_hangul}
            </abbr>)
          </span>
        </p>
      );
    case "Height":
      val = printf(_("cm"), idol.height);
      break;
    case "Weight":
      val = printf(_("kg"), idol.weight);
      break;
    }
    return (
      <p class="idol-info-line">
        <span class="idol-info-key">{_(key)}</span>
        <span class="idol-info-val">{val}</span>
      </p>
    );
  }
  private handlePreviewChange = (idol: Idol, imageId: string) => {
    // Easier to fix in place and re-render than rebuild bandMap every
    // time.
    idol.image_id = imageId;
    this.forceUpdate();
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
            bandMap={bandMap}
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

// tslint:disable-next-line:interface-over-type-literal
type WrapperProps = {};

interface WrapperState {
  loading: boolean;
  query: string;
}

class ProfilesWrapper extends Component<WrapperProps, WrapperState> {
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
  public render(props: WrapperProps, { loading, query }: WrapperState) {
    return (
      <span class="header-profiles-wrapper">
        <input
          ref={(i) => this.inputEl = i as HTMLInputElement}
          class="header-profiles-search"
          placeholder={_("searchIdol")}
          onFocus={this.handleSearchFocus}
          onInput={this.handleSearch}
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
  private handleSearchFocus = () => {
    if (!this.state.loading && !this.state.query) {
      this.setState({loading: true});
      getProfiles().then((profiles) => {
        this.profiles = profiles;
        this.bandMap = getBandMap(profiles);
        this.setState({loading: false});
      }).catch(showAlert);
    }
  }
  private handleSearch = () => {
    if (!this.state.loading) {
      const query = this.inputEl.value;
      this.setState({query});
    }
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
      (document.querySelector(".header-profiles-search") as HTMLInputElement)
        .focus();
    });
  }
}
