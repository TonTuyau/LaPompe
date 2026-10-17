// What YouTube page this is, and where LaPompe's button goes on it. YouTube changes page without loading one (its own
// navigation), and redraws its parts: these are asked again whenever the page changes.

export type PageKind = { kind: 'video'; id: string } | { kind: 'channel'; id: string }

const videoId = /^[A-Za-z0-9_-]{11}$/
const channelId = /^UC[A-Za-z0-9_-]{22}$/

/** A video's page (watch?v=), or a channel's (by its id, or its @handle with the id in the page); null otherwise. */
export function pageKind(location: Location | URL, document: Document): PageKind | null {
  const url = new URL(location.href)
  if (url.pathname === '/watch') {
    const id = url.searchParams.get('v')
    return id && videoId.test(id) ? { kind: 'video', id } : null
  }

  const byId = /^\/channel\/(UC[A-Za-z0-9_-]{22})(\/|$)/.exec(url.pathname)
  if (byId?.[1]) {
    return { kind: 'channel', id: byId[1] }
  }

  if (/^\/(@[^/]+|c\/[^/]+|user\/[^/]+)(\/|$)/.test(url.pathname)) {
    // The page says its channel's id in its canonical link (…/channel/UC…).
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? ''
    const id = /\/channel\/(UC[A-Za-z0-9_-]{22})/.exec(canonical)?.[1]
    return id && channelId.test(id) ? { kind: 'channel', id } : null
  }

  return null
}

/** Where LaPompe's button goes: right after the Subscribe button, or last in the row that holds it. */
export interface Anchor {
  element: Element
  place: 'after' | 'append'
}

export function anchorFor(page: PageKind, document: Document): Anchor | null {
  const candidates: [string, Anchor['place']][] =
    page.kind === 'video'
      ? [
          ['ytd-watch-metadata #owner #subscribe-button', 'after'],
          ['ytd-watch-metadata #owner', 'append'],
        ]
      : [
          ['yt-page-header-view-model yt-flexible-actions-view-model', 'append'],
          ['#page-header yt-flexible-actions-view-model', 'append'],
          ['#channel-header #subscribe-button', 'after'],
        ]
  for (const [selector, place] of candidates) {
    const element = document.querySelector(selector)
    if (element) return { element, place }
  }
  return null
}
