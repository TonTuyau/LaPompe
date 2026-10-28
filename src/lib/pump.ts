// LaPompe's one job, done on its alarm and on "Send the cookie now": read the browser's YouTube cookies, send them to
// each TonTuyau of the settings (0.3.0: every one of them, one after the other; one that fails doesn't stop the others),
// keep what each answered and its version (for the buttons on YouTube's pages); when its version changed (or whether it
// adds isn't known), its connection test again, for whether it takes "Add to TonTuyau".
import { netscapeFile, youTubeCookies } from './netscape'
import { firstInstanceId, isSetUp, loadSettings, type Instance } from './settings'
import { connect, sendCookie, TonTuyauError, type Connection, type CookieState, type Failure } from './tontuyau'

/** The last send to one TonTuyau: when, and either its answer or why it didn't go through. */
export interface LastSend {
  at: string
  cookie?: CookieState
  failure?: Failure
  detail?: string
}

/** The last round: when; nothing sent at all (not set up, no cookie in the browser), or what each TonTuyau answered. */
export interface Pumped {
  at: string
  failure?: 'notSetUp' | 'noCookie'
  /** By instance id. */
  sends: Record<string, LastSend>
}

/**
 * What LaPompe last learned of a TonTuyau: its version (null until it answered once), the key's name, and whether it
 * takes "Add to TonTuyau" (2.0; null until a connection test said).
 */
export interface KnownTonTuyau {
  version: string | null
  name: string | null
  canAdd: boolean | null
}

export const pumpedKey = 'pumped'
export const knownKey = 'known'
/** 0.2.0's keys, for its one TonTuyau: read once as the first instance's, until 0.3.0 writes its own. */
const oldLastSendKey = 'lastSend'
const oldKnownKey = 'tontuyau'

export const unknown: KnownTonTuyau = { version: null, name: null, canAdd: null }

export interface PumpDeps {
  storage: chrome.storage.StorageArea
  cookies: typeof chrome.cookies
  fetch: typeof fetch
  now: () => Date
}

export async function pumpOnce(deps: PumpDeps): Promise<Pumped> {
  const at = deps.now().toISOString()
  const settings = await loadSettings(deps.storage)
  let result: Pumped
  if (!isSetUp(settings)) {
    result = { at, failure: 'notSetUp', sends: {} }
  } else {
    const cookies = await youTubeCookies(deps.cookies)
    if (cookies.length === 0) {
      result = { at, failure: 'noCookie', sends: {} }
    } else {
      const file = netscapeFile(cookies)
      const sends: Record<string, LastSend> = {}
      for (const instance of settings.instances) {
        sends[instance.id] = await sendTo(instance, file, at, deps)
      }
      result = { at, sends }
    }
  }

  await deps.storage.set({ [pumpedKey]: result })
  return result
}

async function sendTo(instance: Instance, file: string, at: string, deps: PumpDeps): Promise<LastSend> {
  try {
    const { cookie, version } = await sendCookie(instance, file, deps.fetch)
    if (version !== null) {
      const known = (await loadKnown(deps.storage))[instance.id] ?? unknown
      if (version !== known.version || known.canAdd === null) {
        // Another TonTuyau (an upgrade): whether it adds now. The cookie went through: a refused test changes it not.
        const connection = await connect(instance, deps.fetch).catch((error: unknown) => {
          if (error instanceof TonTuyauError) return null
          throw error
        })
        await remember(deps.storage, instance.id, connection ? learnedFrom(connection) : { version })
      }
    }
    return { at, cookie }
  } catch (error) {
    if (!(error instanceof TonTuyauError)) {
      throw error
    }
    return { at, failure: error.failure, detail: error.detail }
  }
}

export async function loadPumped(storage: chrome.storage.StorageArea): Promise<Pumped | null> {
  const stored = await storage.get([pumpedKey, oldLastSendKey])
  const pumped = stored[pumpedKey] as Pumped | undefined
  if (pumped !== undefined) return pumped
  // 0.2.0's last send, to its one TonTuyau.
  const old = stored[oldLastSendKey] as (Omit<LastSend, 'failure'> & { failure?: string }) | undefined
  if (old === undefined) return null
  return old.failure === 'notSetUp' || old.failure === 'noCookie'
    ? { at: old.at, failure: old.failure, sends: {} }
    : { at: old.at, sends: { [firstInstanceId]: old as LastSend } }
}

/** What LaPompe knows of each TonTuyau, by instance id (absent: nothing yet). */
export async function loadKnown(storage: chrome.storage.StorageArea): Promise<Record<string, KnownTonTuyau>> {
  const stored = await storage.get([knownKey, oldKnownKey])
  const known = stored[knownKey] as Record<string, KnownTonTuyau> | undefined
  if (known !== undefined) return known
  const old = stored[oldKnownKey] as Partial<KnownTonTuyau> | undefined
  return old === undefined ? {} : { [firstInstanceId]: { ...unknown, ...old } }
}

/** What a connection test says of TonTuyau: a TonTuyau that doesn't say `canAdd` doesn't add. */
export function learnedFrom(connection: Connection): Partial<KnownTonTuyau> {
  return { version: connection.version, name: connection.name, canAdd: connection.canAdd === true }
}

/** Keeps what a TonTuyau said of itself (its version, the key's name), over what was known of it. */
export async function remember(
  storage: chrome.storage.StorageArea,
  instanceId: string,
  learned: Partial<KnownTonTuyau>,
): Promise<void> {
  const known = await loadKnown(storage)
  await storage.set({ [knownKey]: { ...known, [instanceId]: { ...unknown, ...known[instanceId], ...learned } } })
}

/**
 * Forgets what was known of the instances no longer in the settings (removed, or 0.2.0's first one replaced), so a
 * TonTuyau added later at the same id never inherits it.
 */
export async function forgetOthers(storage: chrome.storage.StorageArea, kept: Instance[]): Promise<void> {
  const ids = new Set(kept.map((instance) => instance.id))
  const keep = <T>(byId: Record<string, T>) => Object.fromEntries(Object.entries(byId).filter(([id]) => ids.has(id)))
  const pumped = await loadPumped(storage)
  await storage.set({
    [knownKey]: keep(await loadKnown(storage)),
    ...(pumped ? { [pumpedKey]: { ...pumped, sends: keep(pumped.sends) } } : {}),
  })
  await storage.remove([oldKnownKey, oldLastSendKey])
}
