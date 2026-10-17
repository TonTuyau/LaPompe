import { checkSettings, defaultSettings, isSetUp, loadSettings, originPattern, saveSettings } from './settings'
import { fakeStorage } from '../test/fakeExt'

describe('settings', () => {
  it('start empty: not set up, the cookie every 30 minutes', async () => {
    const storage = fakeStorage()

    const settings = await loadSettings(storage)

    expect(settings).toEqual(defaultSettings)
    expect(settings.everyMinutes).toBe(30)
    expect(isSetUp(settings)).toBe(false)
  })

  it('are kept in the extension storage', async () => {
    const storage = fakeStorage()
    await saveSettings(storage, { url: 'https://tontuyau.example.net', apiKey: 'tt_abc', everyMinutes: 15 })

    expect(await loadSettings(storage)).toEqual({
      url: 'https://tontuyau.example.net',
      apiKey: 'tt_abc',
      everyMinutes: 15,
    })
  })

  it('keep the address to its origin, and the key without spaces', () => {
    const { settings, problems } = checkSettings({
      url: ' https://tontuyau.example.net/admin/youtube?x=1 ',
      apiKey: ' tt_k7Qm0042 ',
      everyMinutes: 30,
    })

    expect(problems).toEqual({})
    expect(settings).toEqual({ url: 'https://tontuyau.example.net', apiKey: 'tt_k7Qm0042', everyMinutes: 30 })
  })

  it.each([
    [{ url: '', apiKey: 'tt_a', everyMinutes: 30 }, { url: 'missing' }],
    [{ url: 'tontuyau', apiKey: 'tt_a', everyMinutes: 30 }, { url: 'notAnAddress' }],
    [{ url: 'ftp://nas', apiKey: 'tt_a', everyMinutes: 30 }, { url: 'notAnAddress' }],
    [{ url: 'http://nas:8080', apiKey: '', everyMinutes: 30 }, { apiKey: 'missing' }],
    [{ url: 'http://nas:8080', apiKey: 'a password', everyMinutes: 30 }, { apiKey: 'notAKey' }],
    [{ url: 'http://nas:8080', apiKey: 'tt_a', everyMinutes: 4 }, { everyMinutes: 'tooShort' }],
    [{ url: 'http://nas:8080', apiKey: 'tt_a', everyMinutes: 7.5 }, { everyMinutes: 'tooShort' }],
  ])('say what is wrong: %o', (typed, expected) => {
    expect(checkSettings(typed).problems).toEqual(expected)
  })

  it("ask the browser for TonTuyau's origin only", () => {
    expect(originPattern('http://192.168.1.40:8080')).toBe('http://192.168.1.40:8080/*')
  })
})
