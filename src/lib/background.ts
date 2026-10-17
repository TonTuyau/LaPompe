// The background: the alarm that sends the cookie every N minutes (the settings'), and the popup's "Send the cookie
// now". Its listeners are added at once when it starts (a Chrome service worker or Firefox event page may be woken
// up for any of them). One send at a time: a second ask while one goes on gets the same answer.
import { pumpOnce, type LastSend } from './pump'
import { isSetUp, loadSettings } from './settings'

export const alarmName = 'pump'

/** The first send after the browser starts or the settings change: soon, not at once (30 s, Chrome's shortest). */
const firstDelayMinutes = 0.5

export interface PumpMessage {
  type: 'pump'
}

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
  ext.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if ((message as PumpMessage | undefined)?.type !== 'pump') {
      return false
    }
    void pump().then(sendResponse)
    // The answer comes later (sendResponse after the send).
    return true
  })
}
