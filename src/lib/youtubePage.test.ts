import { anchorFor, channelIdAt, pageKind } from './youtubePage'

const at = (url: string) => new URL(url)

describe('pageKind', () => {
  it('knows a video by its watch?v=', () => {
    expect(pageKind(at('https://www.youtube.com/watch?v=k3Fq8xZ0aQw&t=42s'))).toEqual({
      kind: 'video',
      id: 'k3Fq8xZ0aQw',
    })
    expect(pageKind(at('https://www.youtube.com/watch?v=short'))).toBeNull()
  })

  it('knows a channel by its id, or by its @handle (its id read later)', () => {
    expect(pageKind(at('https://www.youtube.com/channel/UCx7Lm2QpB0vK9sTq4aZ1wYc/videos'))).toEqual({
      kind: 'channel',
      id: 'UCx7Lm2QpB0vK9sTq4aZ1wYc',
    })
    expect(pageKind(at('https://www.youtube.com/@underthecity/videos'))).toEqual({
      kind: 'channel',
      id: null,
      path: '/@underthecity',
    })
    expect(pageKind(at('https://www.youtube.com/c/UnderTheCity'))).toEqual({
      kind: 'channel',
      id: null,
      path: '/c/UnderTheCity',
    })
  })

  it("doesn't read the open page's head, which YouTube's own navigation leaves behind", () => {
    document.head.innerHTML = '<link rel="canonical" href="https://www.youtube.com/channel/UCBR8-60-B28hp2BmDPdntcQ">'

    expect(pageKind(at('https://www.youtube.com/@underthecity'))).toEqual({
      kind: 'channel',
      id: null,
      path: '/@underthecity',
    })
    document.head.innerHTML = ''
  })

  it('ignores the other pages', () => {
    expect(pageKind(at('https://www.youtube.com/'))).toBeNull()
    expect(pageKind(at('https://www.youtube.com/results?search_query=pump'))).toBeNull()
  })
})

describe('channelIdAt', () => {
  const page = (html: string, status = 200) => vi.fn(async () => new Response(html, { status }))

  it("reads the channel's id from its page's canonical link, fetched anew", async () => {
    const fetchFn = page(
      '<html><head><link rel="canonical" href="https://www.youtube.com/channel/UCx7Lm2QpB0vK9sTq4aZ1wYc"></head></html>',
    )

    expect(await channelIdAt('/@underthecity', fetchFn)).toBe('UCx7Lm2QpB0vK9sTq4aZ1wYc')
    expect(fetchFn).toHaveBeenCalledWith('https://www.youtube.com/@underthecity')
  })

  it("is null when the page doesn't say it (YouTube's consent page, an error)", async () => {
    expect(
      await channelIdAt('/@underthecity', page('<html><head><title>Before you continue</title></head></html>')),
    ).toBeNull()
    expect(await channelIdAt('/@underthecity', page('Not found', 404))).toBeNull()
  })
})

describe('anchorFor', () => {
  it('puts the video button right after Subscribe', () => {
    document.body.innerHTML =
      '<ytd-watch-metadata><div id="owner"><div id="subscribe-button"></div><div id="like"></div></div></ytd-watch-metadata>'

    expect(anchorFor({ kind: 'video', id: 'k3Fq8xZ0aQw' }, document)).toEqual({
      element: document.getElementById('subscribe-button'),
      place: 'after',
    })
  })

  it("puts the channel button last in the header's row of actions", () => {
    document.body.innerHTML =
      '<yt-page-header-view-model><yt-flexible-actions-view-model><button>Subscribe</button></yt-flexible-actions-view-model></yt-page-header-view-model>'

    expect(anchorFor({ kind: 'channel', id: 'UCx7Lm2QpB0vK9sTq4aZ1wYc' }, document)).toMatchObject({
      place: 'append',
    })
  })

  it('finds nothing while YouTube has not drawn it yet', () => {
    document.body.innerHTML = ''

    expect(anchorFor({ kind: 'video', id: 'k3Fq8xZ0aQw' }, document)).toBeNull()
  })
})
