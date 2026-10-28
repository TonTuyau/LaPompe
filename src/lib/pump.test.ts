import { fakeExt, youTubeCookie } from '../test/fakeExt'
import { forgetOthers, loadKnown, loadPumped, pumpOnce, remember } from './pump'

/** 0.2.0's settings: its one TonTuyau, read as instance "1". */
const settings = { url: 'https://tontuyau.example.net', apiKey: 'tt_k7Qm0042', everyMinutes: 30 }
const home = { id: 'a1', name: 'Home', url: 'https://tontuyau.example.net', apiKey: 'tt_k7Qm0042' }
const lucas = { id: 'b2', name: 'Lucas', url: 'https://tube.lucas.example', apiKey: 'tt_Pq8s' }
const now = () => new Date('2026-10-17T08:00:00Z')
const at = '2026-10-17T08:00:00.000Z'
const works = {
  receivedAt: '2026-10-17T08:00:00Z',
  receivedBy: 'Firefox, laptop (API key)',
  state: 'works',
  checkedAt: '2026-10-17T08:00:03Z',
  reason: null,
}

/** TonTuyau: the cookie taken (its version in a header), and its connection test as given. */
function tonTuyau(connection: object | null = { version: '1.5.0', name: 'Firefox, laptop (API key)' }) {
  return vi.fn(async (input: string | URL | Request) =>
    String(input).endsWith('/api/extension/connection')
      ? connection === null
        ? new Response(JSON.stringify({ detail: 'Down.' }), { status: 503 })
        : new Response(JSON.stringify(connection))
      : new Response(JSON.stringify(works), { headers: { 'X-TonTuyau-Version': '1.5.0' } }),
  )
}

function deps(fake: ReturnType<typeof fakeExt>, fetchFn: typeof fetch) {
  return { storage: fake.ext.storage.local, cookies: fake.ext.cookies, fetch: fetchFn, now }
}

describe('pumpOnce', () => {
  it('sends the YouTube cookies as a cookie file, and keeps what TonTuyau answered and its version', async () => {
    const fake = fakeExt({ settings })
    fake.cookies.push(youTubeCookie())
    const fetchFn = tonTuyau()

    const sent = await pumpOnce(deps(fake, fetchFn))

    expect(sent).toEqual({ at, sends: { '1': { at, cookie: works } } })
    expect(await loadPumped(fake.ext.storage.local)).toEqual(sent)
    // A TonTuyau never seen: its connection test too, for whether it adds (a 1.5 doesn't say: no).
    expect(await loadKnown(fake.ext.storage.local)).toEqual({
      '1': { version: '1.5.0', name: 'Firefox, laptop (API key)', canAdd: false },
    })
    const body = JSON.parse(String((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.cookies).toContain('#HttpOnly_.youtube.com\tTRUE\t/\tTRUE\t1820000000\tLOGIN_INFO\tAFmmF2sw')
  })

  it('sends it to every TonTuyau (0.3.0): one that fails stops not the others, each kept apart', async () => {
    const fake = fakeExt({ settings: { instances: [home, lucas], everyMinutes: 30 } })
    fake.cookies.push(youTubeCookie())
    const fetchFn = vi.fn<typeof fetch>(async (input) =>
      String(input).startsWith(home.url)
        ? new Response(JSON.stringify({ detail: 'Down for maintenance.' }), { status: 503 })
        : String(input).endsWith('/api/extension/connection')
          ? new Response(JSON.stringify({ version: '2.3.0', name: 'LaPompe (API key)', canAdd: true }))
          : new Response(JSON.stringify(works), { headers: { 'X-TonTuyau-Version': '2.3.0' } }),
    )

    const sent = await pumpOnce(deps(fake, fetchFn))

    expect(sent).toEqual({
      at,
      sends: {
        a1: { at, failure: 'unexpected', detail: 'Down for maintenance.' },
        b2: { at, cookie: works },
      },
    })
    expect(await loadKnown(fake.ext.storage.local)).toEqual({
      b2: { version: '2.3.0', name: 'LaPompe (API key)', canAdd: true },
    })
    const keys = fetchFn.mock.calls.map(
      ([, init]) => (init as unknown as { headers: Record<string, string> }).headers.Authorization,
    )
    expect(keys).toContain(`Bearer ${home.apiKey}`)
    expect(keys).toContain(`Bearer ${lucas.apiKey}`)
  })

  it('learns that TonTuyau adds from its connection test, once per version', async () => {
    const fake = fakeExt({ settings })
    fake.cookies.push(youTubeCookie())
    const fetchFn = tonTuyau({ version: '1.5.0', name: 'Firefox, laptop (API key)', canAdd: true })

    await pumpOnce(deps(fake, fetchFn))
    await pumpOnce(deps(fake, fetchFn))

    expect((await loadKnown(fake.ext.storage.local))['1']?.canAdd).toBe(true)
    const tests = fetchFn.mock.calls.filter(([url]) => String(url).endsWith('/api/extension/connection'))
    expect(tests).toHaveLength(1)
  })

  it('keeps the version when the connection test fails, and tries it again the next time', async () => {
    const fake = fakeExt({ settings })
    fake.cookies.push(youTubeCookie())

    expect(await pumpOnce(deps(fake, tonTuyau(null)))).toMatchObject({ sends: { '1': { cookie: works } } })
    expect(await loadKnown(fake.ext.storage.local)).toEqual({ '1': { version: '1.5.0', name: null, canAdd: null } })
  })

  it('sends nothing before it is set up', async () => {
    const fake = fakeExt()
    const fetchFn = vi.fn()

    expect(await pumpOnce(deps(fake, fetchFn))).toEqual({ at, failure: 'notSetUp', sends: {} })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('sends nothing when the browser has no YouTube cookie (never on youtube.com, or cleared)', async () => {
    const fake = fakeExt({ settings })
    const fetchFn = vi.fn()

    expect(await pumpOnce(deps(fake, fetchFn))).toMatchObject({ failure: 'noCookie' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('keeps why TonTuyau refused', async () => {
    const fake = fakeExt({ settings })
    fake.cookies.push(youTubeCookie())
    const fetchFn = vi.fn(
      async () => new Response(JSON.stringify({ detail: 'The API key is unknown or disabled.' }), { status: 401 }),
    )

    expect(await pumpOnce(deps(fake, fetchFn))).toEqual({
      at,
      sends: { '1': { at, failure: 'keyRefused', detail: 'The API key is unknown or disabled.' } },
    })
  })
})

describe('what LaPompe keeps of each TonTuyau', () => {
  it("reads 0.2.0's last send and what it knew as the first instance's", async () => {
    const fake = fakeExt({
      lastSend: { at, cookie: works },
      tontuyau: { version: '2.2.0', name: 'Firefox', canAdd: true },
    })

    expect(await loadPumped(fake.ext.storage.local)).toEqual({ at, sends: { '1': { at, cookie: works } } })
    expect(await loadKnown(fake.ext.storage.local)).toEqual({
      '1': { version: '2.2.0', name: 'Firefox', canAdd: true },
    })
    expect(await loadPumped(fakeExt({ lastSend: { at, failure: 'noCookie' } }).ext.storage.local)).toEqual({
      at,
      failure: 'noCookie',
      sends: {},
    })
  })

  it('forgets the instances no longer in the settings', async () => {
    const fake = fakeExt({ tontuyau: { version: '2.2.0', name: null, canAdd: true } })
    const storage = fake.ext.storage.local
    await remember(storage, 'b2', { version: '2.3.0', canAdd: true })
    await storage.set({ pumped: { at, sends: { '1': { at, cookie: works }, b2: { at, cookie: works } } } })

    await forgetOthers(storage, [lucas])

    expect(await loadKnown(storage)).toEqual({ b2: { version: '2.3.0', name: null, canAdd: true } })
    expect(await loadPumped(storage)).toEqual({ at, sends: { b2: { at, cookie: works } } })
    expect(await storage.get('tontuyau')).toEqual({})
  })
})
