import {
  checkSettings,
  defaultSettings,
  isSetUp,
  label,
  loadSettings,
  originPattern,
  saveSettings,
  type Instance,
} from './settings'
import { fakeStorage } from '../test/fakeExt'

const home: Instance = { id: 'a1', name: 'Home', url: 'https://tontuyau.example.net', apiKey: 'tt_abc' }

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
    const lucas = { id: 'b2', name: '', url: 'https://tube.lucas.example', apiKey: 'tt_def' }
    await saveSettings(storage, { instances: [home, lucas], everyMinutes: 15 })

    expect(await loadSettings(storage)).toEqual({ instances: [home, lucas], everyMinutes: 15 })
  })

  it("read 0.2.0's one TonTuyau as the first instance, unnamed (0.3.0)", async () => {
    const storage = fakeStorage({
      settings: { url: 'https://tontuyau.example.net', apiKey: 'tt_abc', everyMinutes: 15 },
    })

    expect(await loadSettings(storage)).toEqual({
      instances: [{ id: '1', name: '', url: 'https://tontuyau.example.net', apiKey: 'tt_abc' }],
      everyMinutes: 15,
    })
    expect(await loadSettings(fakeStorage({ settings: { url: '', apiKey: '', everyMinutes: 30 } }))).toEqual(
      defaultSettings,
    )
  })

  it('keep each address to its origin, the key without spaces, the name trimmed', () => {
    const { settings, problems } = checkSettings({
      instances: [
        { id: 'a1', name: ' Home ', url: ' https://tontuyau.example.net/admin/youtube?x=1 ', apiKey: ' tt_k7Qm0042 ' },
      ],
      everyMinutes: 30,
    })

    expect(problems).toEqual({})
    expect(settings).toEqual({
      instances: [{ id: 'a1', name: 'Home', url: 'https://tontuyau.example.net', apiKey: 'tt_k7Qm0042' }],
      everyMinutes: 30,
    })
  })

  it.each([
    [{ url: '', apiKey: 'tt_a' }, { url: 'missing' }],
    [{ url: 'tontuyau', apiKey: 'tt_a' }, { url: 'notAnAddress' }],
    [{ url: 'ftp://nas', apiKey: 'tt_a' }, { url: 'notAnAddress' }],
    [{ url: 'http://nas:8080', apiKey: '' }, { apiKey: 'missing' }],
    [{ url: 'http://nas:8080', apiKey: 'a password' }, { apiKey: 'notAKey' }],
  ])('say what is wrong with an instance, under its id: %o', (typed, expected) => {
    const { problems } = checkSettings({ instances: [{ id: 'x', name: '', ...typed }], everyMinutes: 30 })

    expect(problems).toEqual({ instances: { x: expected } })
  })

  it.each([4, 7.5])('say an interval of %o is too short', (everyMinutes) => {
    expect(checkSettings({ instances: [home], everyMinutes }).problems).toEqual({ everyMinutes: 'tooShort' })
  })

  it('refuse the same TonTuyau twice: the second one', () => {
    const again = { id: 'b2', name: 'Again', url: 'https://tontuyau.example.net/', apiKey: 'tt_xyz' }

    expect(checkSettings({ instances: [home, again], everyMinutes: 30 }).problems).toEqual({
      instances: { b2: { url: 'twice' } },
    })
  })

  it('call an instance by its name, else by its address', () => {
    expect(label(home)).toBe('Home')
    expect(label({ name: '', url: 'http://nas:8080' })).toBe('nas:8080')
  })

  it("ask the browser for TonTuyau's origin only", () => {
    expect(originPattern('http://192.168.1.40:8080')).toBe('http://192.168.1.40:8080/*')
  })
})
