import { POST_EMBED_SEL } from "../vars"
import { fetchJSON } from "../util"

interface OEmbedDoc {
  title: string
}

function fetchNoEmbed(url: string): Promise<OEmbedDoc> {
  url = `https://noembed.com/embed?url=${url}`
  return fetchJSON(url)
}

function renderYoutube(link: HTMLLinkElement) {
  fetchNoEmbed(link.href).then(res => {
    const icon = document.createElement("i")
    icon.className = "post-embed-icon fa fa-youtube-play"
    link.firstChild.replaceWith(icon, " " + res.title)
  })
}

// Post-render embeddable links.
export function render(el: HTMLElement) {
  for (const link of el.querySelectorAll(POST_EMBED_SEL)) {
    if (link.classList.contains("post-youtube-embed")) {
      renderYoutube(link as HTMLLinkElement)
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

// export function init() {
//   on(document, "mouseover", fetchMeta, {
//     passive: true,
//     selector: "a.embed",
//   })
//   on(document, "click", toggleExpansion, {
//     selector: "a.embed",
//   })
// }
