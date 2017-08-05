import { getEmbed, storeEmbed } from "../db";
import { fetchJSON } from "../util";
import { EMBED_CACHE_EXPIRY_MS, POST_EMBED_SEL } from "../vars";

interface OEmbedDoc {
  title: string;
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
  return fetchJSON(url);
}

function cachedFetch(url: string, provider: string): Promise<OEmbedDoc> {
  return getEmbed<OEmbedDoc>(url).catch(() => {
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
    link.dataset.thumbnail_url = res.thumbnail_url;
    link.dataset.thumbnail_width = res.thumbnail_width.toString();
    link.dataset.thumbnail_height = res.thumbnail_height.toString();
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

// Fetch and render any metadata int the embed on mouseover
// function fetchMeta(e: MouseEvent) {
//   const el = e.target as Element
//   if (el.hasAttribute("data-title-requested")
//     || el.classList.contains("expanded")
//   ) {
//     return
//   }
//   el.setAttribute("data-title-requested", "true")
//   execFetcher(el)
// }

// Toggle the expansion of an embed
// async function toggleExpansion(e: MouseEvent) {
//   const el = e.target as Element

//   // Don't trigger, when user is trying to open in a new tab or fetch has
//   // errored
//   if (e.which !== 1 || e.ctrlKey || el.classList.contains("errored")) {
//     return
//   }
//   e.preventDefault()

//   if (el.classList.contains("expanded")) {
//     el.classList.remove("expanded")
//     const iframe = el.lastChild
//     if (iframe) {
//       iframe.remove()
//     }
//     return
//   }

//   // The embed was clicked before a mouseover (ex: touch screen)
//   if (!el.hasAttribute("data-html")) {
//     await execFetcher(el)
//   }

//   const html = decodeURIComponent(el.getAttribute("data-html")),
//     frag = makeFrag(html)

//   // Restrict embedded iframe access to the page. Improves privacy.
//   for (let el of frag.querySelectorAll("iframe")) {
//     el.setAttribute("referrerpolicy", "no-referrer")
//     el.setAttribute(
//       "sandbox",
//       "allow-scripts allow-same-origin allow-popups allow-modals",
//     )
//   }

//   el.append(frag)
//   el.classList.add("expanded")
// }
