// LaPompe on YouTube's pages: an "Add to TonTuyau" button next to Subscribe, on a video's page and a channel's. It's
// disabled (its tooltip says why) until LaPompe is set up and TonTuyau says it adds (2.0: `canAdd`, its connection
// test). As it appears, it asks TonTuyau where its video or channel stands: "In TonTuyau" (a video it has, a channel
// subscribed to) and "Waiting in TonTuyau" (in its queue) take the place of Add. YouTube changes page and redraws
// without loading a new one: the button is checked again on every change.
import type { AddAnswer, AddMessage } from './background'
import type { Item } from './tontuyau'
import { t } from './i18n'
import { loadKnownTonTuyau, tonTuyauKey } from './pump'
import { isSetUp, loadSettings } from './settings'
import { anchorFor, channelIdAt, pageKind, type PageKind } from './youtubePage'

/** The button's host element: its id, and which page it's for (data-page="video:abc…"). */
export const hostId = 'lapompe-add'

interface Ability {
  enabled: boolean
  why: string
}

/**
 * fetchFn reads a channel's page on youtube.com (its id, for an @handle) as the page itself would: with its cookies
 * (Firefox: the page's content.fetch, not the extension's).
 */
export function startContent(
  window: Window & typeof globalThis,
  ext: typeof chrome,
  fetchFn: typeof fetch = window.fetch.bind(window),
): () => void {
  const document = window.document
  let ability: Ability = { enabled: false, why: '' }
  // A channel's id by its @handle page, once read: the button asks with it, then adds with it.
  const ids = new Map<string, string>()

  const refreshAbility = async () => {
    const [settings, known] = await Promise.all([loadSettings(ext.storage.local), loadKnownTonTuyau(ext.storage.local)])
    ability = !isSetUp(settings)
      ? { enabled: false, why: t('addNotSetUp') }
      : known.version === null
        ? { enabled: false, why: t('addVersionUnknown') }
        : known.canAdd === true
          ? { enabled: true, why: '' }
          : known.canAdd === false
            ? { enabled: false, why: t('addNeedsAdding', known.version) }
            : { enabled: false, why: t('addVersionUnknown') }
  }

  const render = () => {
    const page = pageKind(window.location)
    const current = document.getElementById(hostId)
    const key = page ? pageKey(page) : null
    if (!page) {
      current?.remove()
      return
    }
    const anchor = anchorFor(page, document)
    if (!anchor) return
    if (current?.dataset.page === key && current.dataset.enabled === String(ability.enabled)) {
      // Already there, for this page; put back next to Subscribe if YouTube moved things around.
      const placed =
        anchor.place === 'after'
          ? anchor.element.nextElementSibling === current
          : current.parentElement === anchor.element
      if (placed) return
    }
    current?.remove()
    const host = button(document, page, ability, (type) => asking(page, type, ids, ext, fetchFn))
    if (anchor.place === 'after') {
      anchor.element.after(host)
    } else {
      anchor.element.append(host)
    }
  }

  let scheduled: ReturnType<typeof setTimeout> | null = null
  const later = () => {
    scheduled ??= setTimeout(() => {
      scheduled = null
      render()
    }, 200)
  }

  const observer = new window.MutationObserver(later)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  document.addEventListener('yt-navigate-finish', later)
  const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && ('settings' in changes || tonTuyauKey in changes)) {
      void refreshAbility().then(render)
    }
  }
  ext.storage.onChanged.addListener(onChanged)
  void refreshAbility().then(render)

  return () => {
    observer.disconnect()
    document.removeEventListener('yt-navigate-finish', later)
    ext.storage.onChanged.removeListener(onChanged)
    if (scheduled !== null) clearTimeout(scheduled)
    document.getElementById(hostId)?.remove()
  }
}

const pageKey = (page: PageKind): string => `${page.kind}:${page.id === null ? page.path : page.id}`

/**
 * Asks TonTuyau (through the background) where this page's video or channel stands, or adds it; a channel by its
 * @handle, once its id is read (kept in `ids`).
 */
async function asking(
  page: PageKind,
  type: AddMessage['type'],
  ids: Map<string, string>,
  ext: typeof chrome,
  fetchFn: typeof fetch,
): Promise<AddAnswer> {
  let id: string | null
  try {
    id = page.id ?? ids.get(page.path) ?? (await channelIdAt(page.path, fetchFn))
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) }
  }
  if (id === null) return { ok: false, detail: t('channelIdUnknown') }
  if (page.id === null) ids.set(page.path, id)
  const message: AddMessage = { type, page: { kind: page.kind, id } }
  return (await ext.runtime.sendMessage(message)) as AddAnswer
}

/** The button, in its own shadow root (YouTube's styles don't reach it, its don't reach YouTube). */
function button(
  document: Document,
  page: PageKind,
  ability: Ability,
  ask: (type: AddMessage['type']) => Promise<AddAnswer>,
): HTMLElement {
  const host = document.createElement('span')
  host.id = hostId
  host.dataset.page = pageKey(page)
  host.dataset.enabled = String(ability.enabled)
  const root = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = css
  const button = document.createElement('button')
  button.type = 'button'
  button.disabled = !ability.enabled
  button.title = ability.why
  const label = document.createElement('span')
  const addLabel = page.kind === 'video' ? t('addVideo') : t('addChannel')
  label.textContent = addLabel
  button.append(pump(document), label)
  // What TonTuyau has takes Add's place; without an answer (TonTuyau down), Add stays: adding says why if it fails.
  const show = (item: Item) => {
    if (item.state === 'waiting') {
      label.textContent = t('waitingInTonTuyau')
      button.title = t('waitingHint')
      button.disabled = true
    } else if (item.state === 'inTonTuyau') {
      label.textContent = page.kind === 'video' ? t('videoInTonTuyau') : t('channelInTonTuyau')
      button.title = ''
      button.disabled = true
    }
  }
  if (ability.enabled) {
    void ask('state').then((answer) => {
      if (answer.ok) show(answer.item)
    })
  }
  button.addEventListener('click', () => {
    button.disabled = true
    label.textContent = t('adding')
    void ask('add').then((answer) => {
      if (answer.ok) {
        show(answer.item)
      } else {
        label.textContent = addLabel
        button.title = t('addFailed', answer.detail)
        button.disabled = false
      }
    })
  })
  root.append(style, button)
  return host
}

/** LaPompe's pump (the logo's shapes: icons/lapompe.svg), its lever teal, its body the page's text colour. */
function pump(document: Document): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  const shapes: [string, Record<string, string>][] = [
    ['path', { class: 'lever', d: 'M13 5.6c0-3.1 4.2-4 5.1-1.2l2.9 11.3c.3 1.3 2.2 1.1 2-.3' }],
    ['rect', { class: 'body', x: '5.6', y: '4.6', width: '8.4', height: '2.6', rx: '1.2' }],
    ['rect', { class: 'body', x: '7.3', y: '6.6', width: '5', height: '12.6', rx: '.4' }],
    ['rect', { class: 'body', x: '6.2', y: '10.4', width: '7.2', height: '2.2', rx: '1.1' }],
    ['rect', { class: 'body', x: '6.4', y: '18.4', width: '6.8', height: '2.4', rx: '.6' }],
    ['rect', { class: 'body', x: '4.8', y: '20.2', width: '10', height: '2.4', rx: '1.2' }],
    ['rect', { class: 'body', x: '1.6', y: '11.6', width: '3.1', height: '1.3', rx: '.65' }],
    ['path', { class: 'spout', d: 'M7.6 8.6H4.8c-1 0-1.7.7-1.7 1.7v1.6' }],
  ]
  for (const [name, attributes] of shapes) {
    const shape = document.createElementNS(ns, name)
    for (const [attribute, value] of Object.entries(attributes)) shape.setAttribute(attribute, value)
    svg.append(shape)
  }
  return svg
}

// YouTube's own button shape (36 px, rounded), outlined in TonTuyau's teal; the page's text colour for the pump.
const css = `
button {
  display: inline-flex; align-items: center; gap: 6px; height: 36px; margin-left: 8px; padding: 0 14px 0 10px;
  border: 1px solid #0f8b8d; border-radius: 18px; background: transparent; color: #0f8b8d;
  font: 500 14px/1 Roboto, Arial, sans-serif; white-space: nowrap; cursor: pointer;
}
button:hover:not(:disabled) { background: rgb(15 139 141 / 10%); }
button:disabled { opacity: 0.5; cursor: not-allowed; }
svg { width: 20px; height: 20px; flex: none; }
.lever { fill: none; stroke: #0f8b8d; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.body { fill: var(--yt-spec-text-primary, #0f0f0f); }
.spout { fill: none; stroke: var(--yt-spec-text-primary, #0f0f0f); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
`
