// LaPompe's settings, in the extension's own storage (never a web page's): TonTuyau's address, the
// browser-extension API key made in TonTuyau, and how often the YouTube cookie is sent.

export interface Settings {
  /** TonTuyau's address, its origin only: `https://tontuyau.example.net`. Empty: not set up. */
  url: string
  /** A TonTuyau API key of kind "browser extension": `tt_…`. Empty: not set up. */
  apiKey: string
  /** How often the cookie is sent, in minutes. */
  everyMinutes: number
}

export const defaultSettings: Settings = { url: '', apiKey: '', everyMinutes: 30 }

/** The shortest interval: YouTube shouldn't see TonTuyau's checks too often. */
export const minMinutes = 5

const key = 'settings'

export function isSetUp(settings: Settings): boolean {
  return settings.url !== '' && settings.apiKey !== ''
}

export async function loadSettings(storage: chrome.storage.StorageArea): Promise<Settings> {
  const stored = (await storage.get(key))[key] as Partial<Settings> | undefined
  return { ...defaultSettings, ...stored }
}

export async function saveSettings(storage: chrome.storage.StorageArea, settings: Settings): Promise<void> {
  await storage.set({ [key]: settings })
}

/** What's wrong with these settings, by field; empty when they can be saved. */
export interface SettingsProblems {
  url?: 'missing' | 'notAnAddress'
  apiKey?: 'missing' | 'notAKey'
  everyMinutes?: 'tooShort'
}

/** The settings as typed, cleaned up (the address cut to its origin), with what's wrong with them. */
export function checkSettings(typed: Settings): { settings: Settings; problems: SettingsProblems } {
  const problems: SettingsProblems = {}
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

  if (!Number.isInteger(typed.everyMinutes) || typed.everyMinutes < minMinutes) {
    problems.everyMinutes = 'tooShort'
  }

  return { settings: { url, apiKey, everyMinutes: typed.everyMinutes }, problems }
}

/** The host permission pattern for TonTuyau's address (what the browser is asked to let LaPompe reach). */
export function originPattern(url: string): string {
  return `${new URL(url).origin}/*`
}
