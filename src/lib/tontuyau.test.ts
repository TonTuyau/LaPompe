import { connect, sendCookie, TonTuyauError } from './tontuyau'

const settings = { url: 'https://tontuyau.example.net', apiKey: 'tt_k7Qm0042', everyMinutes: 30 }

function answer(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

describe('TonTuyau', () => {
  it("asks who it is with the key, and gets its version and the key's name", async () => {
    const fetchFn = vi.fn(async () => answer(200, { version: '1.5.0', name: 'Firefox, laptop (API key)' }))

    expect(await connect(settings, fetchFn)).toEqual({ version: '1.5.0', name: 'Firefox, laptop (API key)' })
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://tontuyau.example.net/api/extension/connection')
    expect(init.method).toBe('GET')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tt_k7Qm0042' })
    expect(init.credentials).toBe('omit')
  })

  it("sends the cookie file as JSON, and reads what YouTube said and TonTuyau's version", async () => {
    const state = {
      receivedAt: '2026-10-17T08:00:00Z',
      receivedBy: 'Firefox, laptop (API key)',
      state: 'works',
      checkedAt: '2026-10-17T08:00:03Z',
      reason: null,
    }
    const fetchFn = vi.fn(async () => answer(200, state, { 'X-TonTuyau-Version': '1.5.0' }))

    expect(await sendCookie(settings, '# Netscape HTTP Cookie File\n', fetchFn)).toEqual({
      cookie: state,
      version: '1.5.0',
    })
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://tontuyau.example.net/api/extension/youtube-cookie')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(String(init.body))).toEqual({ cookies: '# Netscape HTTP Cookie File\n' })
  })

  it.each([
    [
      401,
      { title: 'API key refused', detail: 'The API key is unknown or disabled.' },
      'keyRefused',
      'The API key is unknown or disabled.',
    ],
    [
      403,
      { title: 'Not for this key', detail: "This API key's kind doesn't allow this." },
      'keyNotAllowed',
      "This API key's kind doesn't allow this.",
    ],
    [
      400,
      { title: 'Invalid', errors: { cookies: ['holds no youtube.com cookie.'] } },
      'refused',
      'holds no youtube.com cookie.',
    ],
    [502, 'not json', 'unexpected', 'HTTP 502'],
  ])('says why TonTuyau refused (%i)', async (status, body, failure, detail) => {
    const fetchFn = vi.fn(async () =>
      typeof body === 'string' ? new Response(body, { status }) : answer(status, body),
    )

    const error = await connect(settings, fetchFn).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(TonTuyauError)
    expect(error).toMatchObject({ failure, detail, status })
  })

  it("says when TonTuyau can't be reached", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('NetworkError when attempting to fetch resource.')
    })

    await expect(connect(settings, fetchFn)).rejects.toMatchObject({ failure: 'unreachable' })
  })
})
