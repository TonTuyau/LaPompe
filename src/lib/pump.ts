// LaPompe's one job, done on its alarm and on "Send the cookie now": read the browser's YouTube cookies, send them to
// TonTuyau, keep what TonTuyau answered (lastSend) and its version (for the buttons on YouTube's pages).
import { netscapeFile, youTubeCookies } from './netscape'
import { isSetUp, loadSettings } from './settings'
import { sendCookie, TonTuyauError, type CookieState, type Failure } from './tontuyau'

/** The last send: when, and either TonTuyau's answer or why it didn't go through. */
export interface LastSend {
  at: string
  cookie?: CookieState
  failure?: Failure | 'notSetUp' | 'noCookie'
  detail?: string
}

/** What LaPompe last learned of TonTuyau: its version (null until it answered once). */
export interface KnownTonTuyau {
  version: string | null
  name: string | null
}

export const lastSendKey = 'lastSend'
export const tonTuyauKey = 'tontuyau'

export interface PumpDeps {
  storage: chrome.storage.StorageArea
  cookies: typeof chrome.cookies
  fetch: typeof fetch
  now: () => Date
}

export async function pumpOnce(deps: PumpDeps): Promise<LastSend> {
  const at = deps.now().toISOString()
  const settings = await loadSettings(deps.storage)
  let result: LastSend
  if (!isSetUp(settings)) {
    result = { at, failure: 'notSetUp' }
  } else {
    const cookies = await youTubeCookies(deps.cookies)
    if (cookies.length === 0) {
      result = { at, failure: 'noCookie' }
    } else {
      try {
        const { cookie, version } = await sendCookie(settings, netscapeFile(cookies), deps.fetch)
        result = { at, cookie }
        if (version !== null) {
          await remember(deps.storage, { version })
        }
      } catch (error) {
        if (!(error instanceof TonTuyauError)) {
          throw error
        }
        result = { at, failure: error.failure, detail: error.detail }
      }
    }
  }

  await deps.storage.set({ [lastSendKey]: result })
  return result
}

export async function loadLastSend(storage: chrome.storage.StorageArea): Promise<LastSend | null> {
  return ((await storage.get(lastSendKey))[lastSendKey] as LastSend | undefined) ?? null
}

export async function loadKnownTonTuyau(storage: chrome.storage.StorageArea): Promise<KnownTonTuyau> {
  const known = (await storage.get(tonTuyauKey))[tonTuyauKey] as Partial<KnownTonTuyau> | undefined
  return { version: known?.version ?? null, name: known?.name ?? null }
}

/** Keeps what TonTuyau said of itself (its version, the key's name), over what was known. */
export async function remember(storage: chrome.storage.StorageArea, learned: Partial<KnownTonTuyau>): Promise<void> {
  const known = await loadKnownTonTuyau(storage)
  await storage.set({ [tonTuyauKey]: { ...known, ...learned } })
}
