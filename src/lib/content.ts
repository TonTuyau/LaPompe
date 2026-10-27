// LaPompe on YouTube's pages: an "Add to TonTuyau" button next to Subscribe, on a video's page and a channel's. It's
// disabled (its tooltip says why) until LaPompe is set up and a TonTuyau says it adds (2.0: `canAdd`, its connection
// test). As it appears, it asks each TonTuyau where its video or channel stands: with one TonTuyau, "In TonTuyau" (a
// video it has, a channel subscribed to) and "Waiting in TonTuyau" (in its queue) take the place of Add; with several
// (0.3.0), the button sums them up ("In 1 of 2 TonTuyau") and opens a menu: each TonTuyau, where it stands there, Add
// on those that don't have it. YouTube changes page and redraws without loading a new one: the button is checked again
// on every change.
import type { AddAnswer, AddMessage } from './background'
import type { Item } from './tontuyau'
import { t } from './i18n'
import { knownKey, loadKnown, unknown } from './pump'
import { label as instanceLabel, loadSettings, type Instance } from './settings'
import { anchorFor, channelIdAt, pageKind, type PageKind } from './youtubePage'

/** The button's host element: its id, and which page it's for (data-page="video:abc…"). */
export const hostId = 'lapompe-add'

/** The menu's host element (with several TonTuyau), on the page's body: YouTube's boxes don't clip it. */
export const menuId = 'lapompe-menu'

/** Whether a TonTuyau can add, and why not. */
interface Ability {
  instance: Instance
  enabled: boolean
  why: string
}

type Ask = (type: AddMessage['type'], instance: string) => Promise<AddAnswer>

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
  let abilities: Ability[] = []
  // A channel's id by its @handle page, once read: the button asks with it, then adds with it.
  const ids = new Map<string, string>()

  const refreshAbility = async () => {
    const [settings, known] = await Promise.all([loadSettings(ext.storage.local), loadKnown(ext.storage.local)])
    abilities = settings.instances.map((instance) => {
      const of = known[instance.id] ?? unknown
      return of.version === null
        ? { instance, enabled: false, why: t('addVersionUnknown') }
        : of.canAdd === true
          ? { instance, enabled: true, why: '' }
          : of.canAdd === false
            ? { instance, enabled: false, why: t('addNeedsAdding', of.version) }
            : { instance, enabled: false, why: t('addVersionUnknown') }
    })
  }

  /** What the button is drawn with: when it changes (an instance, whether it adds), it's drawn again. */
  const signature = () => abilities.map((ability) => `${ability.instance.id}=${String(ability.enabled)}`).join(',')

  const render = () => {
    const page = pageKind(window.location)
    const current = document.getElementById(hostId)
    const key = page ? pageKey(page) : null
    if (!page) {
      current?.remove()
      document.getElementById(menuId)?.remove()
      return
    }
    const anchor = anchorFor(page, document)
    if (!anchor) return
    if (current?.dataset.page === key && current.dataset.abilities === signature()) {
      // Already there, for this page; put back next to Subscribe if YouTube moved things around.
      const placed =
        anchor.place === 'after'
          ? anchor.element.nextElementSibling === current
          : current.parentElement === anchor.element
      if (placed) return
    }
    current?.remove()
    document.getElementById(menuId)?.remove()
    const ask: Ask = (type, instance) => asking(page, type, instance, ids, ext, fetchFn)
    const host =
      abilities.length > 1
        ? menuButton(window, page, abilities, ask)
        : button(document, page, abilities[0] ?? null, ask)
    host.dataset.abilities = signature()
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
    if (area === 'local' && ('settings' in changes || knownKey in changes)) {
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
    document.getElementById(menuId)?.remove()
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
  instance: string,
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
  const message: AddMessage = { type, instance, page: { kind: page.kind, id } }
  return (await ext.runtime.sendMessage(message)) as AddAnswer
}

/** The button's host and its shadow root (YouTube's styles don't reach it, its don't reach YouTube). */
function shadowHost(document: Document, id: string, page: PageKind): { host: HTMLElement; root: ShadowRoot } {
  const host = document.createElement('span')
  host.id = id
  host.dataset.page = pageKey(page)
  const root = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = css
  root.append(style)
  return { host, root }
}

/** With one TonTuyau (or none: not set up), the button of 0.2.0: Add, or where the page stands there. */
function button(document: Document, page: PageKind, ability: Ability | null, ask: Ask): HTMLElement {
  const { host, root } = shadowHost(document, hostId, page)
  const enabled = ability?.enabled ?? false
  const button = document.createElement('button')
  button.type = 'button'
  button.disabled = !enabled
  button.title = ability ? ability.why : t('addNotSetUp')
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
  if (ability?.enabled) {
    void ask('state', ability.instance.id).then((answer) => {
      if (answer.ok) show(answer.item)
    })
  }
  button.addEventListener('click', () => {
    if (!ability) return
    button.disabled = true
    label.textContent = t('adding')
    void ask('add', ability.instance.id).then((answer) => {
      if (answer.ok) {
        show(answer.item)
      } else {
        label.textContent = addLabel
        button.title = t('addFailed', answer.detail)
        button.disabled = false
      }
    })
  })
  root.append(button)
  return host
}

/** Where the page stands in one TonTuyau, as the menu shows it. */
type Standing = Item['state'] | 'unknown' | 'adding' | { failed: string }

/**
 * With several TonTuyau (0.3.0): one button that sums up where the page stands in those that add, and opens a menu of
 * every TonTuyau, Add on those that don't have it; one that can't add is greyed, saying why.
 */
function menuButton(window: Window & typeof globalThis, page: PageKind, abilities: Ability[], ask: Ask): HTMLElement {
  const document = window.document
  const { host, root } = shadowHost(document, hostId, page)
  const able = abilities.filter((ability) => ability.enabled)
  const standings = new Map<string, Standing>(able.map((ability) => [ability.instance.id, 'unknown']))
  const has = (standing: Standing | undefined) => standing === 'waiting' || standing === 'inTonTuyau'

  const button = document.createElement('button')
  button.type = 'button'
  button.disabled = able.length === 0
  button.title = able.length === 0 ? t('addNoneCan') : ''
  button.setAttribute('aria-haspopup', 'menu')
  button.setAttribute('aria-expanded', 'false')
  const text = document.createElement('span')
  const chevron = document.createElement('span')
  chevron.className = 'chevron'
  chevron.setAttribute('aria-hidden', 'true')
  chevron.textContent = '▾'
  button.append(pump(document), text, chevron)
  root.append(button)

  let menu: HTMLElement | null = null

  const summary = (): string => {
    const holding = able.filter((ability) => has(standings.get(ability.instance.id)))
    if (holding.length === 0) return page.kind === 'video' ? t('addVideo') : t('addChannel')
    if (holding.length < able.length) {
      return t(page.kind === 'video' ? 'videoInSome' : 'channelInSome', holding.length, able.length)
    }
    return holding.some((ability) => standings.get(ability.instance.id) === 'inTonTuyau')
      ? page.kind === 'video'
        ? t('videoInTonTuyau')
        : t('channelInTonTuyau')
      : t('waitingInTonTuyau')
  }

  const row = (ability: Ability): HTMLElement => {
    const item = document.createElement('div')
    item.className = ability.enabled ? 'item' : 'item off'
    item.setAttribute('role', 'menuitem')
    item.setAttribute('aria-disabled', String(!ability.enabled))
    const who = document.createElement('div')
    who.className = 'who'
    const name = document.createElement('b')
    name.textContent = instanceLabel(ability.instance)
    const under = document.createElement('small')
    under.textContent = ability.enabled ? new URL(ability.instance.url).host : ability.why
    who.append(name, under)
    item.append(who)

    const standing = standings.get(ability.instance.id)
    const state = document.createElement('span')
    state.className = 'state'
    if (!ability.enabled) {
      state.textContent = '—'
      item.append(state)
    } else if (standing === 'adding') {
      state.textContent = t('adding')
      item.append(state)
    } else if (standing === 'inTonTuyau' || standing === 'waiting') {
      state.classList.add('done')
      state.textContent =
        standing === 'waiting' ? t('menuWaiting') : page.kind === 'video' ? t('videoInTonTuyau') : t('menuSubscribed')
      if (standing === 'waiting') state.title = t('waitingHint')
      item.append(state)
    } else {
      const add = document.createElement('button')
      add.type = 'button'
      add.className = 'add'
      add.textContent = t('menuAdd')
      if (typeof standing === 'object') {
        add.title = t('addFailed', standing.failed)
        under.textContent = t('addFailed', standing.failed)
        under.className = 'failed'
      }
      add.addEventListener('click', () => {
        standings.set(ability.instance.id, 'adding')
        update()
        void ask('add', ability.instance.id).then((answer) => {
          standings.set(ability.instance.id, answer.ok ? answer.item.state : { failed: answer.detail })
          update()
        })
      })
      item.append(add)
    }
    return item
  }

  const close = () => {
    menu?.remove()
    menu = null
    button.setAttribute('aria-expanded', 'false')
    window.removeEventListener('click', outside, true)
    window.removeEventListener('keydown', escape, true)
  }
  const outside = (event: Event) => {
    const path = event.composedPath()
    if (!path.includes(host) && (menu === null || !path.includes(menu))) close()
  }
  const escape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close()
  }

  const drawMenu = () => {
    if (menu === null) return
    const menuRoot = menu.shadowRoot as ShadowRoot
    const list = document.createElement('div')
    list.className = 'menu'
    list.setAttribute('role', 'menu')
    const title = document.createElement('div')
    title.className = 'title'
    title.textContent = page.kind === 'video' ? t('menuTitleVideo') : t('menuTitleChannel')
    list.append(title, ...abilities.map(row))
    menuRoot.querySelector('.menu')?.remove()
    menuRoot.append(list)
  }

  const open = () => {
    const shown = shadowHost(document, menuId, page)
    menu = shown.host
    // On the page's body, under the button, its right edge on the button's.
    const rect = button.getBoundingClientRect()
    const width = 320
    menu.style.position = 'absolute'
    menu.style.zIndex = '2300'
    menu.style.top = `${rect.bottom + window.scrollY + 6}px`
    menu.style.left = `${Math.max(8, rect.right + window.scrollX - width)}px`
    menu.style.width = `${width}px`
    document.body.append(menu)
    drawMenu()
    button.setAttribute('aria-expanded', 'true')
    window.addEventListener('click', outside, true)
    window.addEventListener('keydown', escape, true)
  }

  const update = () => {
    text.textContent = summary()
    drawMenu()
  }

  button.addEventListener('click', () => {
    if (menu === null) open()
    else close()
  })
  // The host gone (another page, settings changed): its menu with it.
  new window.MutationObserver(() => {
    if (!host.isConnected && menu !== null) close()
  }).observe(document.body, { childList: true, subtree: true })

  for (const ability of able) {
    void ask('state', ability.instance.id).then((answer) => {
      if (answer.ok && standings.get(ability.instance.id) === 'unknown') {
        standings.set(ability.instance.id, answer.item.state)
        update()
      }
    })
  }
  update()
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
.chevron { margin-left: 2px; font-size: 12px; }
.menu {
  padding: 8px 0; border-radius: 12px; background: var(--yt-spec-menu-background, #fff);
  color: var(--yt-spec-text-primary, #0f0f0f); font: 400 14px/1.4 Roboto, Arial, sans-serif;
  box-shadow: 0 4px 32px rgb(0 0 0 / 10%), 0 0 0 1px var(--yt-spec-10-percent-layer, rgb(0 0 0 / 10%));
}
.title { padding: 4px 16px 8px; color: var(--yt-spec-text-secondary, #606060); font-size: 12px; }
.item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 16px; }
.item:hover { background: var(--yt-spec-10-percent-layer, rgb(0 0 0 / 5%)); }
.item.off { opacity: 0.55; }
.who { display: flex; flex-direction: column; min-width: 0; }
.who small { color: var(--yt-spec-text-secondary, #606060); font-size: 12px; overflow-wrap: anywhere; }
.who small.failed { color: #cc0000; }
.state { flex: none; color: var(--yt-spec-text-secondary, #606060); font-size: 13px; }
.state.done { color: #0f8b8d; font-weight: 500; }
button.add { height: 30px; margin: 0; padding: 0 14px; font-size: 13px; }
.lever { fill: none; stroke: #0f8b8d; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.body { fill: var(--yt-spec-text-primary, #0f0f0f); }
.spout { fill: none; stroke: var(--yt-spec-text-primary, #0f0f0f); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
`
