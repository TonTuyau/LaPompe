// LaPompe's one job, done on its alarm and on "Send the cookie now": read the browser's YouTube cookies, send them to
// TonTuyau, keep what TonTuyau answered (lastSend) and its version (for the buttons on YouTube's pages); when its
// version changed (or whether it adds isn't known), the connection test again, for whether it takes "Add to TonTuyau".
import { netscapeFile, youTubeCookies } from './netscape'
import { isSetUp, loadSettings } from './settings'
import { connect, sendCookie, TonTuyauError, type Connection, type CookieState, type Failure } from './tontuyau'

/** The last send: when, and either TonTuyau's answer or why it didn't go through. */
export interface LastSend {
  at: string
  cookie?: CookieState
  failure?: Failure | 'notSetUp' | 'noCookie'
  detail?: string
}

/**
 * What LaPompe last learned of TonTuyau: its version (null until it answered once), the key's name, and whether it takes
 * "Add to TonTuyau" (2.0; null until a connection test said).
 */
export interface KnownTonTuyau {
  version: string | null
  name: string | null
  canAdd: boolean | null
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
          const known = await loadKnownTonTuyau(deps.storage)
          if (version !== known.version || known.canAdd === null) {
            // Another TonTuyau (an upgrade): whether it adds now. The cookie went through: a refused test changes it not.
            const connection = await connect(settings, deps.fetch).catch((error: unknown) => {
              if (error instanceof TonTuyauError) return null
              throw error
            })
            await remember(deps.storage, connection ? learnedFrom(connection) : { version })
          }
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
  return { version: known?.version ?? null, name: known?.name ?? null, canAdd: known?.canAdd ?? null }
}

/** What a connection test says of TonTuyau: a TonTuyau that doesn't say `canAdd` doesn't add. */
export function learnedFrom(connection: Connection): Partial<KnownTonTuyau> {
  return { version: connection.version, name: connection.name, canAdd: connection.canAdd === true }
}

/** Keeps what TonTuyau said of itself (its version, the key's name), over what was known. */
export async function remember(storage: chrome.storage.StorageArea, learned: Partial<KnownTonTuyau>): Promise<void> {
  const known = await loadKnownTonTuyau(storage)
  await storage.set({ [tonTuyauKey]: { ...known, ...learned } })
}
