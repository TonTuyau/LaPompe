import { fakeExt, type FakeExt } from '../test/fakeExt'
import { startBackground } from './background'
import { hostId, menuId, startContent } from './content'

const settings = { url: 'https://tontuyau.example.net', apiKey: 'tt_k7Qm0042', everyMinutes: 30 }
const watchPage =
  '<ytd-watch-metadata><div id="owner"><div id="subscribe-button"></div><div id="like"></div></div></ytd-watch-metadata>'

let stop: (() => void) | null = null

const channelHeader =
  '<yt-page-header-view-model><yt-flexible-actions-view-model><button>Subscribe</button></yt-flexible-actions-view-model></yt-page-header-view-model>'

function open(url: string, body: string, fake: FakeExt, youTubeFetch?: typeof fetch) {
  ;(globalThis as { chrome?: typeof chrome }).chrome = fake.ext
  history.replaceState(null, '', url)
  document.body.innerHTML = body
  stop = startContent(window, fake.ext, youTubeFetch)
}

/** A TonTuyau that adds: what it has of each id ("absent" when not named), a run for what's added. */
function tonTuyauWith(states: Record<string, string> = {}) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const id = String(input).split('/').pop() ?? ''
    const answer =
      init?.method === 'POST' ? { state: 'waiting', runId: 'run-1' } : { state: states[id] ?? 'absent', runId: null }
    return new Response(JSON.stringify(answer), { status: init?.method === 'POST' ? 202 : 200 })
  })
}

const adds = { version: '2.0.0-alpha.2', name: null, canAdd: true }

const host = () => document.getElementById(hostId)
const shadowButton = () => host()?.shadowRoot?.querySelector('button') ?? null

afterEach(() => {
  stop?.()
  stop = null
  document.body.innerHTML = ''
  history.replaceState(null, '', '/')
})

describe('the buttons on YouTube', () => {
  it('puts "Add to TonTuyau" right after Subscribe, disabled when TonTuyau doesn\'t add, saying why', async () => {
    open(
      '/watch?v=k3Fq8xZ0aQw',
      watchPage,
      fakeExt({ settings, tontuyau: { version: '1.5.0', name: null, canAdd: false } }),
    )

    await vi.waitFor(() => expect(host()).not.toBeNull())
    expect(document.getElementById('subscribe-button')?.nextElementSibling).toBe(host())
    expect(host()?.dataset.page).toBe('video:k3Fq8xZ0aQw')
    expect(shadowButton()).toBeDisabled()
    expect(shadowButton()).toHaveTextContent('Add to TonTuyau')
    expect(shadowButton()?.title).toBe('Needs a TonTuyau that downloads videos (2.0 or later; yours has 1.5.0).')
  })

  it('says to set LaPompe up first, or to test the connection, while it can not know', async () => {
    open('/watch?v=k3Fq8xZ0aQw', watchPage, fakeExt())
    await vi.waitFor(() => expect(shadowButton()?.title).toMatch(/Set LaPompe up first/))
    stop?.()

    open('/watch?v=k3Fq8xZ0aQw', watchPage, fakeExt({ settings, tontuyau: { version: '2.0.0', name: null } }))
    await vi.waitFor(() => expect(shadowButton()?.title).toMatch(/doesn't know yet whether your TonTuyau can add/))
  })

  it('with a TonTuyau that adds, asks where the video stands, adds it through the background, then says it waits', async () => {
    const fake = fakeExt({ settings, tontuyau: adds })
    const fetchFn = tonTuyauWith()
    startBackground(fake.ext, fetchFn)
    open('/watch?v=k3Fq8xZ0aQw', watchPage, fake)

    await vi.waitFor(() => expect(shadowButton()).toBeEnabled())
    await vi.waitFor(() =>
      expect(fetchFn).toHaveBeenCalledWith(
        'https://tontuyau.example.net/api/extension/videos/k3Fq8xZ0aQw',
        expect.objectContaining({ method: 'GET' }),
      ),
    )
    shadowButton()?.click()

    await vi.waitFor(() => expect(shadowButton()).toHaveTextContent('Waiting in TonTuyau'))
    expect(shadowButton()).toBeDisabled()
    expect(shadowButton()?.title).toBe("In TonTuyau's queue: it's downloaded when its turn comes.")
    expect(fetchFn).toHaveBeenCalledWith(
      'https://tontuyau.example.net/api/extension/videos/k3Fq8xZ0aQw',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('says "In TonTuyau" for a video it has, "Waiting in TonTuyau" for one it\'s downloading, instead of Add', async () => {
    const fake = fakeExt({ settings, tontuyau: adds })
    startBackground(fake.ext, tonTuyauWith({ k3Fq8xZ0aQw: 'inTonTuyau', a1b2c3d4e5f: 'waiting' }))
    open('/watch?v=k3Fq8xZ0aQw', watchPage, fake)

    await vi.waitFor(() => expect(shadowButton()).toHaveTextContent('In TonTuyau'))
    expect(shadowButton()).toBeDisabled()
    stop?.()

    open('/watch?v=a1b2c3d4e5f', watchPage, fake)
    await vi.waitFor(() => expect(shadowButton()).toHaveTextContent('Waiting in TonTuyau'))
    expect(shadowButton()).toBeDisabled()
  })

  it('turns enabled as soon as LaPompe learns TonTuyau adds', async () => {
    const fake = fakeExt({ settings, tontuyau: { version: '1.5.0', name: null, canAdd: false } })
    startBackground(fake.ext, tonTuyauWith())
    open('/watch?v=k3Fq8xZ0aQw', watchPage, fake)
    await vi.waitFor(() => expect(shadowButton()).toBeDisabled())

    await fake.ext.storage.local.set({ known: { '1': adds } })

    await vi.waitFor(() => expect(shadowButton()).toBeEnabled())
  })

  it('follows YouTube to another page: gone where there is no video or channel', async () => {
    open('/watch?v=k3Fq8xZ0aQw', watchPage, fakeExt({ settings }))
    await vi.waitFor(() => expect(host()).not.toBeNull())

    history.pushState(null, '', '/results?search_query=pump')
    document.dispatchEvent(new Event('yt-navigate-finish'))

    await vi.waitFor(() => expect(host()).toBeNull())
  })

  it('puts "Add channel to TonTuyau" on a channel page, "Subscribed in TonTuyau" once it is', async () => {
    const fake = fakeExt({ settings, tontuyau: { version: '1.5.0', name: null, canAdd: false } })
    open('/channel/UCx7Lm2QpB0vK9sTq4aZ1wYc', channelHeader, fake)

    await vi.waitFor(() => expect(shadowButton()).toHaveTextContent('Add channel to TonTuyau'))
    expect(host()?.parentElement?.tagName.toLowerCase()).toBe('yt-flexible-actions-view-model')
    stop?.()

    const subscribed = fakeExt({ settings, tontuyau: adds })
    startBackground(subscribed.ext, tonTuyauWith({ UCx7Lm2QpB0vK9sTq4aZ1wYc: 'inTonTuyau' }))
    open('/channel/UCx7Lm2QpB0vK9sTq4aZ1wYc', channelHeader, subscribed)
    await vi.waitFor(() => expect(shadowButton()).toHaveTextContent('Subscribed in TonTuyau'))
  })

  it('puts it on a channel opened by its @handle too, asks and adds that channel by the id its page says', async () => {
    const fake = fakeExt({ settings, tontuyau: adds })
    const tonTuyau = tonTuyauWith()
    startBackground(fake.ext, tonTuyau)
    const youTube = vi.fn(
      async () =>
        new Response('<link rel="canonical" href="https://www.youtube.com/channel/UCx7Lm2QpB0vK9sTq4aZ1wYc">'),
    )
    // The open page's head names another channel: YouTube's own navigation left it there.
    document.head.innerHTML = '<link rel="canonical" href="https://www.youtube.com/channel/UCBR8-60-B28hp2BmDPdntcQ">'
    open('/@underthecity/videos', channelHeader, fake, youTube)

    await vi.waitFor(() => expect(shadowButton()).toBeEnabled())
    expect(host()?.dataset.page).toBe('channel:/@underthecity')
    await vi.waitFor(() =>
      expect(tonTuyau).toHaveBeenCalledWith(
        'https://tontuyau.example.net/api/extension/channels/UCx7Lm2QpB0vK9sTq4aZ1wYc',
        expect.objectContaining({ method: 'GET' }),
      ),
    )
    shadowButton()?.click()

    await vi.waitFor(() => expect(shadowButton()).toHaveTextContent('Waiting in TonTuyau'))
    // Its id read once, from its @handle page.
    expect(youTube).toHaveBeenCalledTimes(1)
    expect(youTube).toHaveBeenCalledWith('https://www.youtube.com/@underthecity')
    expect(tonTuyau).toHaveBeenCalledWith(
      'https://tontuyau.example.net/api/extension/channels/UCx7Lm2QpB0vK9sTq4aZ1wYc',
      expect.objectContaining({ method: 'POST' }),
    )
    document.head.innerHTML = ''
  })

  it("says so when YouTube's page doesn't name the channel, and adds nothing", async () => {
    const fake = fakeExt({ settings, tontuyau: adds })
    const tonTuyau = tonTuyauWith()
    startBackground(fake.ext, tonTuyau)
    open(
      '/@underthecity',
      channelHeader,
      fake,
      vi.fn(async () => new Response('<title>Before you continue</title>')),
    )

    await vi.waitFor(() => expect(shadowButton()).toBeEnabled())
    shadowButton()?.click()

    await vi.waitFor(() =>
      expect(shadowButton()?.title).toBe("Not added: YouTube's page didn't say which channel this is."),
    )
    expect(shadowButton()).toBeEnabled()
    expect(tonTuyau).not.toHaveBeenCalled()
  })

  describe('with several TonTuyau (0.3.0)', () => {
    const home = { id: 'a1', name: 'Home', url: 'https://tontuyau.example.net', apiKey: 'tt_k7Qm0042' }
    const lucas = { id: 'b2', name: 'Lucas', url: 'https://tube.lucas.example', apiKey: 'tt_Pq8s' }
    const old = { id: 'c3', name: '', url: 'https://old.tontuyau.example', apiKey: 'tt_Zz0y' }
    const several = { instances: [home, lucas, old], everyMinutes: 30 }
    const known = { a1: adds, b2: adds, c3: { version: '1.5.1', name: null, canAdd: false } }

    /** Home has the video, Lucas doesn't: each answers for itself, Lucas adds. */
    const tonTuyaus = () =>
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)
        const answer =
          init?.method === 'POST'
            ? { state: 'waiting', runId: 'run-2' }
            : { state: url.startsWith(home.url) ? 'inTonTuyau' : 'absent', runId: null }
        return new Response(JSON.stringify(answer), { status: init?.method === 'POST' ? 202 : 200 })
      })

    const menu = () => document.getElementById(menuId)?.shadowRoot ?? null
    const rows = () => [...(menu()?.querySelectorAll('.item') ?? [])] as HTMLElement[]

    it('sums up where the video stands in those that add, and opens a menu of each', async () => {
      const fake = fakeExt({ settings: several, known })
      startBackground(fake.ext, tonTuyaus())
      open('/watch?v=k3Fq8xZ0aQw', watchPage, fake)

      await vi.waitFor(() => expect(shadowButton()).toHaveTextContent('In 1 of 2 TonTuyau'))
      expect(shadowButton()).toBeEnabled()
      expect(shadowButton()).toHaveAttribute('aria-expanded', 'false')
      shadowButton()?.click()

      expect(shadowButton()).toHaveAttribute('aria-expanded', 'true')
      expect(menu()?.querySelector('.title')).toHaveTextContent('This video in your TonTuyau')
      expect(rows().map((row) => row.textContent)).toEqual([
        'Hometontuyau.example.netIn TonTuyau',
        'Lucastube.lucas.exampleAdd',
        'old.tontuyau.exampleNeeds a TonTuyau that downloads videos (2.0 or later; yours has 1.5.1).—',
      ])
      expect(rows()[2]).toHaveAttribute('aria-disabled', 'true')
    })

    it("adds to the one picked, then says it's there", async () => {
      const fake = fakeExt({ settings: several, known })
      const fetchFn = tonTuyaus()
      startBackground(fake.ext, fetchFn)
      open('/watch?v=k3Fq8xZ0aQw', watchPage, fake)
      await vi.waitFor(() => expect(shadowButton()).toHaveTextContent('In 1 of 2 TonTuyau'))
      shadowButton()?.click()

      rows()[1]?.querySelector('button')?.click()

      await vi.waitFor(() => expect(rows()[1]).toHaveTextContent('Waiting'))
      expect(shadowButton()).toHaveTextContent('In TonTuyau')
      expect(fetchFn).toHaveBeenCalledWith(
        'https://tube.lucas.example/api/extension/videos/k3Fq8xZ0aQw',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(fetchFn).not.toHaveBeenCalledWith(
        expect.stringContaining(home.url),
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('closes its menu on Escape, a click elsewhere, or another page', async () => {
      const fake = fakeExt({ settings: several, known })
      startBackground(fake.ext, tonTuyaus())
      open('/watch?v=k3Fq8xZ0aQw', watchPage, fake)
      await vi.waitFor(() => expect(shadowButton()).toBeEnabled())

      shadowButton()?.click()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(menu()).toBeNull()

      shadowButton()?.click()
      document.body.click()
      expect(menu()).toBeNull()

      shadowButton()?.click()
      history.pushState(null, '', '/results?search_query=pump')
      document.dispatchEvent(new Event('yt-navigate-finish'))
      await vi.waitFor(() => expect(menu()).toBeNull())
    })

    it('is disabled when none of them adds, saying why', async () => {
      const fake = fakeExt({ settings: several, known: { c3: known.c3 } })
      open('/channel/UCx7Lm2QpB0vK9sTq4aZ1wYc', channelHeader, fake)

      await vi.waitFor(() => expect(shadowButton()).toBeDisabled())
      expect(shadowButton()).toHaveTextContent('Add channel to TonTuyau')
      expect(shadowButton()?.title).toMatch(/None of your TonTuyau can add yet/)
    })
  })
})
