// LaPompe's settings, in the extension's own storage (never a web page's): the TonTuyau it sends to (0.3.0: several,
// each with its address, the browser-extension API key made in it, and a name of its own), and how often the YouTube
// cookie is sent (to all of them, on one alarm).

/** One TonTuyau. */
export interface Instance {
  /** LaPompe's own id for it (what it last answered is kept under it); never shown. */
  id: string
  /** A name typed in the settings ("Home", "Lucas"); empty: its address's host is shown. */
  name: string
  /** Its address, its origin only: `https://tontuyau.example.net`. */
  url: string
  /** A TonTuyau API key of kind "browser extension": `tt_…`. */
  apiKey: string
}

export interface Settings {
  /** The TonTuyau LaPompe sends to, in the order shown. None: not set up. */
  instances: Instance[]
  /** How often the cookie is sent, in minutes. */
  everyMinutes: number
}

export const defaultSettings: Settings = { instances: [], everyMinutes: 30 }

/** The shortest interval: YouTube shouldn't see TonTuyau's checks too often. */
export const minMinutes = 5

const key = 'settings'

/** The id 0.2.0's one TonTuyau gets when its settings are read by 0.3.0. */
export const firstInstanceId = '1'

export function isSetUp(settings: Settings): boolean {
  return settings.instances.length > 0
}

/** What the settings page, the popup and the button call it: its name, else its address's host. */
export function label(instance: Pick<Instance, 'name' | 'url'>): string {
  if (instance.name !== '') return instance.name
  try {
    return new URL(instance.url).host
  } catch {
    return instance.url
  }
}

/** A new instance's id: unique enough among the few a browser has. */
export function newInstanceId(): string {
  return crypto.randomUUID().slice(0, 8)
}

/** Settings as 0.2.0 kept them: one TonTuyau. */
interface OneTonTuyau {
  url?: string
  apiKey?: string
  everyMinutes?: number
}

export async function loadSettings(storage: chrome.storage.StorageArea): Promise<Settings> {
  const stored = (await storage.get(key))[key] as (Partial<Settings> & OneTonTuyau) | undefined
  if (stored?.instances === undefined) {
    // 0.2.0's settings (or none): its TonTuyau becomes the first instance, unnamed.
    const url = stored?.url ?? ''
    const apiKey = stored?.apiKey ?? ''
    return {
      instances: url === '' && apiKey === '' ? [] : [{ id: firstInstanceId, name: '', url, apiKey }],
      everyMinutes: stored?.everyMinutes ?? defaultSettings.everyMinutes,
    }
  }
  return { instances: stored.instances, everyMinutes: stored.everyMinutes ?? defaultSettings.everyMinutes }
}

export async function saveSettings(storage: chrome.storage.StorageArea, settings: Settings): Promise<void> {
  await storage.set({ [key]: settings })
}

/** What's wrong with one instance, by field. */
export interface InstanceProblems {
  url?: 'missing' | 'notAnAddress' | 'twice'
  apiKey?: 'missing' | 'notAKey'
}

/** What's wrong with these settings: by instance id, and the interval; empty when they can be saved. */
export interface SettingsProblems {
  instances?: Record<string, InstanceProblems>
  everyMinutes?: 'tooShort'
}

export function hasProblems(problems: SettingsProblems): boolean {
  return problems.everyMinutes !== undefined || Object.keys(problems.instances ?? {}).length > 0
}

/** One instance as typed, cleaned up (the address cut to its origin, the name trimmed), with what's wrong with it. */
export function checkInstance(typed: Instance): { instance: Instance; problems: InstanceProblems } {
  const problems: InstanceProblems = {}
  let url = typed.url.trim()
  if (url === '') {
    problems.url = 'missing'
  } else {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        problems.url = 'notAnAddress'
      } else {
        url = parsed.origin
      }
    } catch {
      problems.url = 'notAnAddress'
    }
  }

  const apiKey = typed.apiKey.trim()
  if (apiKey === '') {
    problems.apiKey = 'missing'
  } else if (!/^tt_[A-Za-z0-9_-]+$/.test(apiKey)) {
    problems.apiKey = 'notAKey'
  }

  return { instance: { id: typed.id, name: typed.name.trim(), url, apiKey }, problems }
}

/** The settings as typed, cleaned up, with what's wrong with them (a TonTuyau given twice: the second one). */
export function checkSettings(typed: Settings): { settings: Settings; problems: SettingsProblems } {
  const problems: SettingsProblems = {}
  const instances: Instance[] = []
  const seen = new Set<string>()
  for (const typedInstance of typed.instances) {
    const checked = checkInstance(typedInstance)
    if (checked.problems.url === undefined && seen.has(checked.instance.url)) {
      checked.problems.url = 'twice'
    }
    seen.add(checked.instance.url)
    if (Object.keys(checked.problems).length > 0) {
      problems.instances = { ...problems.instances, [checked.instance.id]: checked.problems }
    }
    instances.push(checked.instance)
  }

  if (!Number.isInteger(typed.everyMinutes) || typed.everyMinutes < minMinutes) {
    problems.everyMinutes = 'tooShort'
  }

  return { settings: { instances, everyMinutes: typed.everyMinutes }, problems }
}

/** The host permission pattern for a TonTuyau's address (what the browser is asked to let LaPompe reach). */
export function originPattern(url: string): string {
  return `${new URL(url).origin}/*`
}
