import { fakeExt, youTubeCookie } from '../test/fakeExt'
import { loadKnownTonTuyau, loadLastSend, pumpOnce } from './pump'

const settings = { url: 'https://tontuyau.example.net', apiKey: 'tt_k7Qm0042', everyMinutes: 30 }
const now = () => new Date('2026-10-17T08:00:00Z')
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

    expect(sent).toEqual({ at: '2026-10-17T08:00:00.000Z', cookie: works })
    expect(await loadLastSend(fake.ext.storage.local)).toEqual(sent)
    // A TonTuyau never seen: its connection test too, for whether it adds (a 1.5 doesn't say: no).
    expect(await loadKnownTonTuyau(fake.ext.storage.local)).toEqual({
      version: '1.5.0',
      name: 'Firefox, laptop (API key)',
      canAdd: false,
    })
    const body = JSON.parse(String((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.cookies).toContain('#HttpOnly_.youtube.com\tTRUE\t/\tTRUE\t1820000000\tLOGIN_INFO\tAFmmF2sw')
  })

  it('learns that TonTuyau adds from its connection test, once per version', async () => {
    const fake = fakeExt({ settings })
    fake.cookies.push(youTubeCookie())
    const fetchFn = tonTuyau({ version: '1.5.0', name: 'Firefox, laptop (API key)', canAdd: true })

    await pumpOnce(deps(fake, fetchFn))
    await pumpOnce(deps(fake, fetchFn))

    expect((await loadKnownTonTuyau(fake.ext.storage.local)).canAdd).toBe(true)
    const tests = fetchFn.mock.calls.filter(([url]) => String(url).endsWith('/api/extension/connection'))
    expect(tests).toHaveLength(1)
  })

  it('keeps the version when the connection test fails, and tries it again the next time', async () => {
    const fake = fakeExt({ settings })
    fake.cookies.push(youTubeCookie())

    expect(await pumpOnce(deps(fake, tonTuyau(null)))).toMatchObject({ cookie: works })
    expect(await loadKnownTonTuyau(fake.ext.storage.local)).toEqual({ version: '1.5.0', name: null, canAdd: null })
  })

  it('sends nothing before it is set up', async () => {
    const fake = fakeExt()
    const fetchFn = vi.fn()

    expect(await pumpOnce(deps(fake, fetchFn))).toEqual({ at: '2026-10-17T08:00:00.000Z', failure: 'notSetUp' })
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
      at: '2026-10-17T08:00:00.000Z',
      failure: 'keyRefused',
      detail: 'The API key is unknown or disabled.',
    })
  })
})
