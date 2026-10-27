// The background: the alarm that sends the cookie every N minutes (the settings', to every TonTuyau), the popup's "Send
// the cookie now", and the YouTube pages' button (where a video or channel stands in a TonTuyau, adding it there). Its listeners are added
// at once when it starts (a Chrome service worker or Firefox event page may be woken up for any of them). One send at a
// time: a second ask while one goes on gets the same answer.
import { pumpOnce, type Pumped } from './pump'
import { isSetUp, loadSettings } from './settings'
import { add, itemState, TonTuyauError, type Item, type Page } from './tontuyau'

export const alarmName = 'pump'

/** The first send after the browser starts or the settings change: soon, not at once (30 s, Chrome's shortest). */
const firstDelayMinutes = 0.5

export interface PumpMessage {
  type: 'pump'
}

/** From a YouTube page's button (TonTuyau 2.0): add this video or channel to that TonTuyau, or say where it stands. */
export interface AddMessage {
  type: 'add' | 'state'
  /** The instance's id (0.3.0). */
  instance: string
  page: Page
}

/** TonTuyau's answer (the item as it stands now), or why there's none. */
export type AddAnswer = { ok: true; item: Item } | { ok: false; detail: string }

export function startBackground(ext: typeof chrome, fetchFn: typeof fetch = fetch): void {
  let running: Promise<Pumped> | null = null
  const pump = (): Promise<Pumped> =>
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
  const ask = async (message: AddMessage): Promise<AddAnswer> => {
    try {
      const settings = await loadSettings(ext.storage.local)
      const instance = settings.instances.find((candidate) => candidate.id === message.instance)
      if (!instance) return { ok: false, detail: ext.i18n.getMessage('addGone') }
      const item =
        message.type === 'add'
          ? await add(instance, message.page, fetchFn)
          : await itemState(instance, message.page, fetchFn)
      return { ok: true, item }
    } catch (error) {
      if (!(error instanceof TonTuyauError)) throw error
      return { ok: false, detail: error.detail }
    }
  }

  ext.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    const sent = message as PumpMessage | AddMessage | undefined
    if (sent?.type === 'pump') {
      void pump().then(sendResponse)
    } else if (sent?.type === 'add' || sent?.type === 'state') {
      void ask(sent).then(sendResponse)
    } else {
      return false
    }
    // The answer comes later (sendResponse once TonTuyau answered).
    return true
  })
}
