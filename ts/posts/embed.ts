import { getEmbed, storeEmbed } from "../db";
import { fetchJSON } from "../util";
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

const oEmbedHosts = {
  vlive: "/api/embed",
  youtube: "https://noembed.com/embed",
};

const embedIcons = {
  vlive: "fa fa-hand-peace-o",
  youtube: "fa fa-youtube-play",
};

function fetchEmbed(url: string, provider: string): Promise<OEmbedDoc> {
  url = `${oEmbedHosts[provider]}?url=${url}`;
  return fetchJSON<OEmbedDoc>(url).then((res) => {
    // Should actually fail because of 400+ status code but some
    // services (e.g. noembed) doesn't set it.
    if (res.error) throw new Error(res.error);
    return res;
  });
}

function cachedFetch(url: string, provider: string): Promise<OEmbedDoc> {
  return getEmbed<OEmbedDoc>(url).then((res) => {
    // TODO(Kagami): Remove after a month.
    if (res.error) throw new Error(res.error);
    return res;
  }).catch(() => {
    return fetchEmbed(url, provider).then((res) => {
      storeEmbed(url, res, EMBED_CACHE_EXPIRY_MS);
      return res;
    });
  });
}

// Additional rendering of embedded media link.
function renderLink(link: HTMLLinkElement) {
  const provider = link.dataset.provider;
  cachedFetch(link.href, provider).then((res) => {
    const icon = document.createElement("i");
    icon.className = `post-embed-icon ${embedIcons[provider]}`;
    link.firstChild.replaceWith(icon, " " + res.title);
    link.dataset.html = res.html.trim();
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
