import { anchorFor, pageKind } from './youtubePage'

const at = (url: string) => new URL(url)

describe('pageKind', () => {
  it('knows a video by its watch?v=', () => {
    expect(pageKind(at('https://www.youtube.com/watch?v=k3Fq8xZ0aQw&t=42s'), document)).toEqual({
      kind: 'video',
      id: 'k3Fq8xZ0aQw',
    })
    expect(pageKind(at('https://www.youtube.com/watch?v=short'), document)).toBeNull()
  })

  it('knows a channel by its id, or by its @handle with the id in the page', () => {
    expect(pageKind(at('https://www.youtube.com/channel/UCx7Lm2QpB0vK9sTq4aZ1wYc/videos'), document)).toEqual({
      kind: 'channel',
      id: 'UCx7Lm2QpB0vK9sTq4aZ1wYc',
    })

    document.head.innerHTML = '<link rel="canonical" href="https://www.youtube.com/channel/UCx7Lm2QpB0vK9sTq4aZ1wYc">'
    expect(pageKind(at('https://www.youtube.com/@underthecity'), document)).toEqual({
      kind: 'channel',
      id: 'UCx7Lm2QpB0vK9sTq4aZ1wYc',
    })
    document.head.innerHTML = ''
    expect(pageKind(at('https://www.youtube.com/@underthecity'), document)).toBeNull()
  })

  it('ignores the other pages', () => {
    expect(pageKind(at('https://www.youtube.com/'), document)).toBeNull()
    expect(pageKind(at('https://www.youtube.com/results?search_query=pump'), document)).toBeNull()
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
