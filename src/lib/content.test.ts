import { fakeExt, type FakeExt } from '../test/fakeExt'
import { startBackground } from './background'
import { hostId, startContent } from './content'

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

const host = () => document.getElementById(hostId)
const shadowButton = () => host()?.shadowRoot?.querySelector('button') ?? null

afterEach(() => {
  stop?.()
  stop = null
  document.body.innerHTML = ''
  history.replaceState(null, '', '/')
})

describe('the buttons on YouTube', () => {
  it('puts "Add to TonTuyau" right after Subscribe, disabled before TonTuyau 1.6, saying why', async () => {
    open('/watch?v=k3Fq8xZ0aQw', watchPage, fakeExt({ settings, tontuyau: { version: '1.5.0', name: null } }))

    await vi.waitFor(() => expect(host()).not.toBeNull())
    expect(document.getElementById('subscribe-button')?.nextElementSibling).toBe(host())
    expect(host()?.dataset.page).toBe('video:k3Fq8xZ0aQw')
    expect(shadowButton()).toBeDisabled()
    expect(shadowButton()).toHaveTextContent('Add to TonTuyau')
    expect(shadowButton()?.title).toBe('Needs TonTuyau 1.6, which downloads videos (yours has 1.5.0).')
  })

  it('says to set LaPompe up first, or to test the connection, while it can not know', async () => {
    open('/watch?v=k3Fq8xZ0aQw', watchPage, fakeExt())
    await vi.waitFor(() => expect(shadowButton()?.title).toMatch(/Set LaPompe up first/))
    stop?.()

    open('/watch?v=k3Fq8xZ0aQw', watchPage, fakeExt({ settings }))
    await vi.waitFor(() => expect(shadowButton()?.title).toMatch(/doesn't know your TonTuyau's version yet/))
  })

  it('with TonTuyau 1.6, adds the video through the background', async () => {
    const fake = fakeExt({ settings, tontuyau: { version: '1.6.0', name: null } })
    const fetchFn = vi.fn(async () => new Response(null, { status: 202 }))
    startBackground(fake.ext, fetchFn)
    open('/watch?v=k3Fq8xZ0aQw', watchPage, fake)

    await vi.waitFor(() => expect(shadowButton()).toBeEnabled())
    shadowButton()?.click()

    await vi.waitFor(() => expect(shadowButton()).toHaveTextContent('Added to TonTuyau'))
    expect(fetchFn).toHaveBeenCalledWith(
      'https://tontuyau.example.net/api/extension/videos/k3Fq8xZ0aQw',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('turns enabled as soon as LaPompe learns TonTuyau is 1.6', async () => {
    const fake = fakeExt({ settings, tontuyau: { version: '1.5.0', name: null } })
    open('/watch?v=k3Fq8xZ0aQw', watchPage, fake)
    await vi.waitFor(() => expect(shadowButton()).toBeDisabled())

    await fake.ext.storage.local.set({ tontuyau: { version: '1.6.0', name: null } })

    await vi.waitFor(() => expect(shadowButton()).toBeEnabled())
  })

  it('follows YouTube to another page: gone where there is no video or channel', async () => {
    open('/watch?v=k3Fq8xZ0aQw', watchPage, fakeExt({ settings }))
    await vi.waitFor(() => expect(host()).not.toBeNull())

    history.pushState(null, '', '/results?search_query=pump')
    document.dispatchEvent(new Event('yt-navigate-finish'))

    await vi.waitFor(() => expect(host()).toBeNull())
  })

  it('puts "Add channel to TonTuyau" on a channel page', async () => {
    open(
      '/channel/UCx7Lm2QpB0vK9sTq4aZ1wYc',
      channelHeader,
      fakeExt({ settings, tontuyau: { version: '1.5.0', name: null } }),
    )

    await vi.waitFor(() => expect(shadowButton()).toHaveTextContent('Add channel to TonTuyau'))
    expect(host()?.parentElement?.tagName.toLowerCase()).toBe('yt-flexible-actions-view-model')
  })

  it('puts it on a channel opened by its @handle too, and adds that channel by the id its page says', async () => {
    const fake = fakeExt({ settings, tontuyau: { version: '1.6.0', name: null } })
    const tonTuyau = vi.fn(async () => new Response(null, { status: 202 }))
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
    expect(youTube).not.toHaveBeenCalled()
    shadowButton()?.click()

    await vi.waitFor(() => expect(shadowButton()).toHaveTextContent('Added to TonTuyau'))
    expect(youTube).toHaveBeenCalledWith('https://www.youtube.com/@underthecity')
    expect(tonTuyau).toHaveBeenCalledWith(
      'https://tontuyau.example.net/api/extension/channels/UCx7Lm2QpB0vK9sTq4aZ1wYc',
      expect.objectContaining({ method: 'POST' }),
    )
    document.head.innerHTML = ''
  })

  it("says so when YouTube's page doesn't name the channel, and adds nothing", async () => {
    const fake = fakeExt({ settings, tontuyau: { version: '1.6.0', name: null } })
    const tonTuyau = vi.fn(async () => new Response(null, { status: 202 }))
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
})
