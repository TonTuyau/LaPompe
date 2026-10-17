// What YouTube page this is, and where LaPompe's button goes on it. YouTube changes page without loading one (its own
// navigation), and redraws its parts: these are asked again whenever the page changes.

export type PageKind =
  | { kind: 'video'; id: string }
  | { kind: 'channel'; id: string }
  // By its @handle (or an old /c/ or /user/ address): its id is read from its page when it's needed (channelIdAt).
  | { kind: 'channel'; id: null; path: string }

const videoId = /^[A-Za-z0-9_-]{11}$/
const channelId = /^UC[A-Za-z0-9_-]{22}$/

/** A video's page (watch?v=), or a channel's (by its id, or by its @handle); null otherwise. */
export function pageKind(location: Location | URL): PageKind | null {
  const url = new URL(location.href)
  if (url.pathname === '/watch') {
    const id = url.searchParams.get('v')
    return id && videoId.test(id) ? { kind: 'video', id } : null
  }

  const byId = /^\/channel\/(UC[A-Za-z0-9_-]{22})(\/|$)/.exec(url.pathname)
  if (byId?.[1]) {
    return { kind: 'channel', id: byId[1] }
  }

  const byName = /^\/(@[^/]+|c\/[^/]+|user\/[^/]+)(\/|$)/.exec(url.pathname)
  if (byName?.[1]) {
    return { kind: 'channel', id: null, path: `/${byName[1]}` }
  }

  return null
}

/**
 * The id of the channel at this address (an @handle), from its page fetched anew; null when the page doesn't say it.
 * Not from the open page: YouTube's own navigation leaves its head behind (its canonical link then says the @handle,
 * and its other links still the first channel opened in the tab).
 */
export async function channelIdAt(path: string, fetchFn: typeof fetch): Promise<string | null> {
  const response = await fetchFn(new URL(path, 'https://www.youtube.com').href)
  if (!response.ok) return null
  const html = await response.text()
  const id = /<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/channel\/([^"/?]+)"/.exec(html)?.[1]
  return id && channelId.test(id) ? id : null
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
