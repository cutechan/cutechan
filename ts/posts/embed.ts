import { getEmbed, storeEmbed } from "../db";
import { linkEmbeds } from "../templates";
import { Dict, fetchJSON } from "../util";
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
};

const embedResponses: { [key: string]: (res: Dict) => OEmbedDoc } = {
  vlive: (res) => res as OEmbedDoc,
  youtube: (res) => {
    const item = res.items[0];
    const id = item.id;
    const player = item.player;
    const snippet = item.snippet;
    const thumbs = snippet.thumbnails;
    const thumb = thumbs.maxres || thumbs.high;
    return {
      title: snippet.title,
      html: `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1"></iframe>`,
      width: player.embedWidth,
      height: player.embedHeight,
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
      storeEmbed(url, res, EMBED_CACHE_EXPIRY_MS);
      return res;
    });
  });
}

const embedIcons = {
  vlive: "fa fa-hand-peace-o",
  youtube: "fa fa-youtube-play",
};

// Additional rendering of embedded media link.
function renderLink(link: HTMLLinkElement) {
  const provider = link.dataset.provider;
  cachedFetch(link.href, provider).then((res) => {
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
  });
}

// Post-render embeddable links.
export function render(postEl: HTMLElement) {
  if (postEl.classList.contains("post_embed")) {
    for (const link of postEl.querySelectorAll(POST_EMBED_SEL)) {
      renderLink(link as HTMLLinkElement);
    }
  }
}
