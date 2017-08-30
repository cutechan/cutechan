import { getEmbed, setEmbed } from "../db";
import { linkEmbeds } from "../templates";
import { Dict, fetchJSON, noop } from "../util";
import { EMBED_CACHE_EXPIRY_MS, POST_EMBED_SEL } from "../vars";

interface OEmbedDoc {
  error?: string;
  title: string;
  html: string;
  width: number;
  height: number;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
}

// TODO(Kagami): Move to config.
const YT_KEY = "AIzaSyDr4-0yU43u4WzrPIwAL-IdRtHAlY7dnbc";

const embedUrls: { [key: string]: (url: string) => string } = {
  vlive: (url) => `/api/embed?url=${url}`,
  youtube: (url) => {
    const id = linkEmbeds.youtube.exec(url)[1];
    const attrs = [
      `key=${YT_KEY}`,
      `id=${id}`,
      `maxWidth=1280`,
      `maxHeight=720`,
      `part=snippet,player`,
    ];
    return `https://www.googleapis.com/youtube/v3/videos?${attrs.join("&")}`;
  },
  youtubepls: (url) => {
    const id = linkEmbeds.youtubepls.exec(url)[1];
    const attrs = [
      `key=${YT_KEY}`,
      `id=${id}`,
      `part=snippet,contentDetails`,
    ];
    return `https://www.googleapis.com/youtube/v3/playlists?${attrs.join("&")}`;
  },
};

const embedResponses: { [key: string]: (res: Dict) => OEmbedDoc } = {
  vlive: (res) => res as OEmbedDoc,
  youtube: (res) => {
    const item = res.items[0];
    // TODO(Kagami): Cache fail responses.
    if (!item) throw new Error("not found");
    const id = item.id;
    const player = item.player;
    const snippet = item.snippet;
    const thumbs = snippet.thumbnails;
    const thumb = thumbs.maxres || thumbs.high;
    return {
      title: snippet.title,
      html: `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1"></iframe>`,
      // Sometimes these numbers are missed.
      width: player.embedWidth || 1280,
      height: player.embedHeight || 720,
      thumbnail_url: thumb.url,
      thumbnail_width: thumb.width,
      thumbnail_height: thumb.height,
    };
  },
  youtubepls: (res) => {
    const item = res.items[0];
    if (!item) throw new Error("not found");
    const id = item.id;
    const snippet = item.snippet;
    const count = item.contentDetails.itemCount;
    const title = `${snippet.title} (${count})`;
    const thumbs = snippet.thumbnails;
    const thumb = thumbs.maxres || thumbs.high;
    return {
      title,
      html: `<iframe src="https://www.youtube.com/embed/videoseries?list=${id}&autoplay=1"></iframe>`,
      // Since playlist contains a lot of videos, there is no single
      // resolution, so use just common HD res.
      width: 1280,
      height: 720,
      thumbnail_url: thumb.url,
      thumbnail_width: thumb.width,
      thumbnail_height: thumb.height,
    };
  },
};

function fetchEmbed(url: string, provider: string): Promise<OEmbedDoc> {
  url = embedUrls[provider](url);
  return fetchJSON<Dict>(url).then(embedResponses[provider]);
}

function cachedFetch(url: string, provider: string): Promise<OEmbedDoc> {
  return getEmbed<OEmbedDoc>(url).catch(() => {
    return fetchEmbed(url, provider).then((res) => {
      setEmbed(url, res, EMBED_CACHE_EXPIRY_MS);
      return res;
    });
  });
}

const embedIcons = {
  vlive: "fa fa-hand-peace-o",
  youtube: "fa fa-youtube-play",
  youtubepls: "fa fa-bars",
};

/** Additional rendering of embedded media link. */
function renderLink(link: HTMLLinkElement): Promise<void> {
  const provider = link.dataset.provider;
  const url = link.href;
  return cachedFetch(url, provider).then((res) => {
    const icon = document.createElement("i");
    icon.className = `post-embed-icon ${embedIcons[provider]}`;
    link.firstChild.replaceWith(icon, " " + res.title);
    link.dataset.html = res.html;
    link.dataset.width = res.width.toString();
    link.dataset.height = res.height.toString();
    link.dataset.thumbnail_url = res.thumbnail_url;
    link.dataset.thumbnail_width = res.thumbnail_width.toString();
    link.dataset.thumbnail_height = res.thumbnail_height.toString();
    link.classList.add("trigger-media-popup");
  }, (err) => {
    // tslint:disable-next-line:no-console
    console.error(`Failed to embed ${url}: ${err.message}`);
  });
}

/**
 * Post-render embeddable links.
 *
 * Resulting promise is guaranteed to always successfully resolve when
 * rendering is finished, even if some links failed.
 */
export function render(postEl: HTMLElement): Promise<void> {
  if (!postEl.classList.contains("post_embed")) return Promise.resolve();
  const proms = [];
  for (const link of postEl.querySelectorAll(POST_EMBED_SEL)) {
    proms.push(renderLink(link as HTMLLinkElement));
  }
  return Promise.all(proms).then(noop);
}
