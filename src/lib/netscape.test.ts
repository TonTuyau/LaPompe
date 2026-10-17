import { netscapeFile, youTubeCookies } from './netscape'

function cookie(overrides: Partial<chrome.cookies.Cookie>): chrome.cookies.Cookie {
  return {
    domain: '.youtube.com',
    hostOnly: false,
    httpOnly: false,
    name: 'PREF',
    path: '/',
    sameSite: 'unspecified',
    secure: true,
    session: false,
    storeId: '0',
    value: 'f6=40000000',
    expirationDate: 1_820_000_000.5,
    ...overrides,
  }
}

describe('netscapeFile', () => {
  it('writes a line a cookie, 7 fields by tabs, under the header', () => {
    expect(netscapeFile([cookie({})])).toBe(
      '# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t1820000000\tPREF\tf6=40000000\n',
    )
  })

  it('marks HttpOnly cookies, host-only ones, session ones, and sorts them', () => {
    const file = netscapeFile([
      cookie({ name: 'SID', httpOnly: true }),
      cookie({ domain: 'www.youtube.com', hostOnly: true, name: 'VISITOR', secure: false }),
      cookie({ name: 'YSC', session: true, expirationDate: undefined }),
    ])

    expect(file.split('\n').slice(1, -1)).toEqual([
      '#HttpOnly_.youtube.com\tTRUE\t/\tTRUE\t1820000000\tSID\tf6=40000000',
      '.youtube.com\tTRUE\t/\tTRUE\t0\tYSC\tf6=40000000',
      'www.youtube.com\tFALSE\t/\tFALSE\t1820000000\tVISITOR\tf6=40000000',
    ])
  })
})

describe('youTubeCookies', () => {
  it('keeps youtube.com and its subdomains only', async () => {
    const getAll = vi.fn(async () => [
      cookie({ name: 'A' }),
      cookie({ domain: 'm.youtube.com', name: 'B' }),
      cookie({ domain: '.notyoutube.com', name: 'C' }),
    ])

    const kept = await youTubeCookies({ getAll } as unknown as typeof chrome.cookies)

    expect(kept.map((c) => c.name)).toEqual(['A', 'B'])
    expect(getAll).toHaveBeenCalledWith({ domain: 'youtube.com' })
  })
})
