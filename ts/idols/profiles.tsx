/**
 * Working with idol profiles.
 *
 * @module cutechan/idols/profiles
 */

import { Component, h, render } from "preact";
import hangul from "hangeul";
import {
  BandMap,
  getBandMap,
  getIdolPreviewUrl,
  getProfiles,
  Idol,
  ImageIdData,
  Profiles,
  RenderedLine,
  renderIdol,
  searchIdols,
  setIdolPreview,
} from "kpopnet/api";
import { showAlert } from "../alerts";
import { isPowerUser } from "../auth";
import _ from "../lang";
import { getFilePrefix } from "../posts";
import { hook, HOOKS, printf } from "../util";
import { PROFILES_CONTAINER_SEL } from "../vars";
import { BackgroundClickMixin, EscapePressMixin } from "../widgets";

interface PreviewProps {
  idol: Idol;
  onChange: (idol: Idol, imageId: string) => void;
}

class IdolPreview extends Component<PreviewProps, any> {
  private fileEl: HTMLInputElement = null;
  public render({ idol }: PreviewProps) {
    const opts = { small: true, prefix: getFilePrefix() };
    const previewUrl = getIdolPreviewUrl(idol, opts);
    const style = { backgroundImage: `url(${previewUrl})` };
    return (
      <div class="idol-preview" style={style} onClick={this.handlePreviewClick}>
        <input
          ref={(f) => (this.fileEl = f as HTMLInputElement)}
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
  };
  private handleFileChange = () => {
    const files = this.fileEl.files;
    if (files.length) {
      this.handleFile(files[0]);
    }
    this.fileEl.value = ""; // Allow to select same file again
  };
  private handleFile(file: File) {
    const { idol } = this.props;
    setIdolPreview(idol, file)
      .then(({ SHA1 }: ImageIdData) => {
        this.props.onChange(idol, SHA1);
      })
      .catch(showAlert);
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
    // label_icon may be omitted but if present both must present.
    const { label_icon, label_name } = bandMap.get(idol.band_id);
    return (
      <section class="idol">
        <IdolPreview idol={idol} onChange={this.handlePreviewChange} />
        <div class="idol-info">
          {lines.map(this.rerenderLine.bind(this, idol))}
        </div>
        {label_icon && (
          <div class="idol-label" title={label_name}>
            <i class={`label label-${label_icon}`} />
          </div>
        )}
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
        ru = hangul.runame(idol.name_hangul);
        if (!ru) break;
        return (
          <p class="idol-info-line">
            <span class="idol-info-key">{_(key)}</span>
            <span class="idol-info-val">
              {idol.name} (
              <abbr class="idol-info-abbr" title={ru}>
                {idol.name_hangul}
              </abbr>
              )
            </span>
          </p>
        );
      case "Real name":
        if (!idol.birth_name_hangul) break;
        ru = hangul.runame(idol.birth_name_hangul);
        if (!ru) break;
        return (
          <p class="idol-info-line">
            <span class="idol-info-key">{_(key)}</span>
            <span class="idol-info-val">
              {idol.birth_name} (
              <abbr class="idol-info-abbr" title={ru}>
                {idol.birth_name_hangul}
              </abbr>
              )
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
  };
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
        {idols.map((idol) => (
          <IdolItem key={idol.id} idol={idol} bandMap={bandMap} />
        ))}
      </article>
    );
  }
}

function Spinner() {
  return <i class="header-profiles-spinner fa fa-spinner fa-pulse fa-fw"></i>;
}

// tslint:disable-next-line:interface-over-type-literal
type WrapperProps = {};

interface WrapperState {
  loading: boolean;
  query: string;
}

class ProfilesWrapperBase extends Component<WrapperProps, WrapperState> {
  private profiles: Profiles = null;
  private bandMap: BandMap = null;
  constructor() {
    super();
    this.state = {
      loading: false,
      query: "",
    };
  }
  public render(props: WrapperProps, { loading, query }: WrapperState) {
    return (
      <span class="header-profiles-wrapper" onClick={this.handleWrapperClick}>
        <input
          class="header-profiles-search"
          placeholder={_("searchIdol")}
          value={query}
          onFocus={this.handleSearchFocus}
          onInput={this.handleSearch}
        />
        {loading && <Spinner />}
        <IdolList
          profiles={this.profiles}
          bandMap={this.bandMap}
          query={query}
        />
      </span>
    );
  }
  public onBackgroundClick = () => {
    this.hide();
  };
  public onEscapePress = () => {
    this.hide();
  };
  private hide = () => {
    if (this.state.query) {
      this.setState({ query: "" });
    }
  };
  private handleWrapperClick = (e: Event) => {
    e.stopPropagation();
  };
  private handleSearchFocus = () => {
    if (!this.state.loading && !this.state.query) {
      this.setState({ loading: true });
      getProfiles()
        .then((profiles) => {
          this.profiles = profiles;
          this.bandMap = getBandMap(profiles);
          this.setState({ loading: false });
        })
        .catch(showAlert);
    }
  };
  private handleSearch = (e: Event) => {
    if (!this.state.loading) {
      const query = (e.target as HTMLInputElement).value;
      this.setState({ query });
    }
  };
}

const ProfilesWrapper = EscapePressMixin(
  BackgroundClickMixin(ProfilesWrapperBase)
);

export function init() {
  const container = document.querySelector(PROFILES_CONTAINER_SEL);
  if (container) {
    // Server-side template renders exactly same search input in order
    // to make preact's kick off seamless.
    container.innerHTML = "";
    render(<ProfilesWrapper />, container);

    hook(HOOKS.focusIdolSearch, () => {
      (document.querySelector(
        ".header-profiles-search"
      ) as HTMLInputElement).focus();
    });
  }
}
