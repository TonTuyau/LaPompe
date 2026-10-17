// The background: the alarm that sends the cookie every N minutes (the settings'), and the popup's "Send the cookie
// now". Its listeners are added at once when it starts (a Chrome service worker or Firefox event page may be woken
// up for any of them). One send at a time: a second ask while one goes on gets the same answer.
import { pumpOnce, type LastSend } from './pump'
import { isSetUp, loadSettings } from './settings'
import { add, TonTuyauError } from './tontuyau'

export const alarmName = 'pump'

/** The first send after the browser starts or the settings change: soon, not at once (30 s, Chrome's shortest). */
const firstDelayMinutes = 0.5

export interface PumpMessage {
  type: 'pump'
}

/** From a YouTube page's button (TonTuyau 1.6): add this video or channel. */
export interface AddMessage {
  type: 'add'
  page: { kind: 'video' | 'channel'; id: string }
}

export type AddAnswer = { ok: true } | { ok: false; detail: string }

export function startBackground(ext: typeof chrome, fetchFn: typeof fetch = fetch): void {
  let running: Promise<LastSend> | null = null
  const pump = (): Promise<LastSend> =>
    (running ??= pumpOnce({
      storage: ext.storage.local,
      cookies: ext.cookies,
      fetch: fetchFn,
      now: () => new Date(),
    }).finally(() => {
      running = null
    }))

  const schedule = async (): Promise<void> => {
    const settings = await loadSettings(ext.storage.local)
    if (!isSetUp(settings)) {
      await ext.alarms.clear(alarmName)
      return
    }
    await ext.alarms.create(alarmName, { delayInMinutes: firstDelayMinutes, periodInMinutes: settings.everyMinutes })
  }

  ext.runtime.onInstalled.addListener(() => void schedule())
  ext.runtime.onStartup.addListener(() => void schedule())
  ext.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && 'settings' in changes) {
      void schedule()
    }
  })
  ext.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === alarmName) {
      void pump()
    }
  })
  const addPage = async (page: AddMessage['page']): Promise<AddAnswer> => {
    try {
      await add(await loadSettings(ext.storage.local), page, fetchFn)
      return { ok: true }
    } catch (error) {
      if (!(error instanceof TonTuyauError)) throw error
      return { ok: false, detail: error.detail }
    }
  }

  ext.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    const sent = message as PumpMessage | AddMessage | undefined
    if (sent?.type === 'pump') {
      void pump().then(sendResponse)
    } else if (sent?.type === 'add') {
      void addPage(sent.page).then(sendResponse)
    } else {
      return false
    }
    // The answer comes later (sendResponse once TonTuyau answered).
    return true
  })
}
