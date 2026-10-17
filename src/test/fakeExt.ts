import english from '../../public/_locales/en/messages.json'

// Small fakes of the WebExtension API, for tests: storage that tells its listeners, events that can be fired, alarms
// that can be rung, messages, cookies.

type Listener = (...args: never[]) => unknown

export interface FakeEvent<L extends Listener> {
  addListener(listener: L): void
  removeListener(listener: L): void
  hasListener(listener: L): boolean
  /** Calls every listener, returns what each returned. */
  fire(...args: Parameters<L>): unknown[]
}

export function fakeEvent<L extends Listener>(): FakeEvent<L> {
  const listeners = new Set<L>()
  return {
    addListener: (listener) => void listeners.add(listener),
    removeListener: (listener) => void listeners.delete(listener),
    hasListener: (listener) => listeners.has(listener),
    fire: (...args) => [...listeners].map((listener) => listener(...args)),
  }
}

type ChangeListener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => void

export function fakeStorage(
  initial: Record<string, unknown> = {},
  onChanged?: FakeEvent<ChangeListener>,
  areaName = 'local',
): chrome.storage.StorageArea {
  const data = new Map<string, unknown>(Object.entries(structuredClone(initial)))
  const area = {
    get: async (keys?: string | string[] | null) => {
      const wanted = keys === undefined || keys === null ? [...data.keys()] : typeof keys === 'string' ? [keys] : keys
      return Object.fromEntries(wanted.filter((k) => data.has(k)).map((k) => [k, structuredClone(data.get(k))]))
    },
    set: async (items: Record<string, unknown>) => {
      const changes: Record<string, chrome.storage.StorageChange> = {}
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: data.get(k), newValue: structuredClone(v) }
        data.set(k, structuredClone(v))
      }
      onChanged?.fire(changes, areaName)
    },
    remove: async (keys: string | string[]) => {
      for (const k of typeof keys === 'string' ? [keys] : keys) data.delete(k)
    },
    clear: async () => data.clear(),
  }
  return area as unknown as chrome.storage.StorageArea
}

export interface FakeExt {
  ext: typeof chrome
  alarms: Map<string, chrome.alarms.AlarmCreateInfo>
  cookies: chrome.cookies.Cookie[]
  events: {
    onInstalled: FakeEvent<() => void>
    onStartup: FakeEvent<() => void>
    onMessage: FakeEvent<(message: unknown, sender: unknown, sendResponse: (answer: unknown) => void) => unknown>
    onAlarm: FakeEvent<(alarm: chrome.alarms.Alarm) => void>
    onChanged: FakeEvent<ChangeListener>
  }
  /** Rings the alarm of that name, as the browser would. */
  ring(name: string): void
  /** Sends a message to the background, as the popup does; resolves with its answer. */
  send(message: unknown): Promise<unknown>
}

export function fakeExt(initial: Record<string, unknown> = {}): FakeExt {
  const events = {
    onInstalled: fakeEvent<() => void>(),
    onStartup: fakeEvent<() => void>(),
    onMessage: fakeEvent<(message: unknown, sender: unknown, sendResponse: (answer: unknown) => void) => unknown>(),
    onAlarm: fakeEvent<(alarm: chrome.alarms.Alarm) => void>(),
    onChanged: fakeEvent<ChangeListener>(),
  }
  const alarms = new Map<string, chrome.alarms.AlarmCreateInfo>()
  const cookies: chrome.cookies.Cookie[] = []
  const ext = {
    storage: { local: fakeStorage(initial, events.onChanged), onChanged: events.onChanged },
    alarms: {
      create: async (name: string, info: chrome.alarms.AlarmCreateInfo) => void alarms.set(name, info),
      clear: async (name: string) => alarms.delete(name),
      get: async (name: string) => {
        const info = alarms.get(name)
        return info === undefined
          ? undefined
          : {
              name,
              scheduledTime: Date.now() + (info.delayInMinutes ?? 0) * 60_000,
              periodInMinutes: info.periodInMinutes,
            }
      },
      onAlarm: events.onAlarm,
    },
    runtime: {
      onInstalled: events.onInstalled,
      onStartup: events.onStartup,
      onMessage: events.onMessage,
      getManifest: () => ({ version: '0.1.0' }),
    },
    cookies: { getAll: async () => structuredClone(cookies) },
    permissions: { request: vi.fn(async () => true) },
    i18n: { getMessage: message, getUILanguage: () => 'en' },
  }
  Object.assign(ext.runtime, {
    sendMessage: (sent: unknown) =>
      new Promise((resolve) => {
        events.onMessage.fire(sent, {}, resolve)
      }),
    openOptionsPage: vi.fn(async () => {}),
  })
  return {
    ext: ext as unknown as typeof chrome,
    alarms,
    cookies,
    events,
    ring: (name) => void events.onAlarm.fire({ name, scheduledTime: Date.now() }),
    send: (message) =>
      new Promise((resolve) => {
        events.onMessage.fire(message, {}, resolve)
      }),
  }
}

/** chrome.i18n.getMessage on the English locale: $1, $2… replaced by the values given. */
export function message(key: string, values: string[] = []): string {
  const entry = (english as Record<string, { message: string } | undefined>)[key]
  return entry ? entry.message.replace(/\$(\d)/g, (_, n: string) => values[Number(n) - 1] ?? '') : ''
}

/** A youtube.com cookie as the browser gives it. */
export function youTubeCookie(overrides: Partial<chrome.cookies.Cookie> = {}): chrome.cookies.Cookie {
  return {
    domain: '.youtube.com',
    hostOnly: false,
    httpOnly: true,
    name: 'LOGIN_INFO',
    path: '/',
    sameSite: 'no_restriction',
    secure: true,
    session: false,
    storeId: '0',
    value: 'AFmmF2sw',
    expirationDate: 1_820_000_000,
    ...overrides,
  }
}
