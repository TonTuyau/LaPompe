import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { alarmName, startBackground } from '../lib/background'
import { fakeExt, youTubeCookie, type FakeExt } from '../test/fakeExt'
import Popup from './Popup.svelte'

const settings = { url: 'https://tontuyau.example.net', apiKey: 'tt_k7Qm0042', everyMinutes: 30 }
const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString()

function use(fake: FakeExt): FakeExt {
  ;(globalThis as { chrome?: typeof chrome }).chrome = fake.ext
  return fake
}

describe('Popup', () => {
  it('says it is not set up yet, and opens the settings', async () => {
    const fake = use(fakeExt())
    const user = userEvent.setup()
    render(Popup)

    expect(await screen.findByText(/Not set up yet/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open the settings' }))

    expect(fake.ext.runtime.openOptionsPage).toHaveBeenCalled()
  })

  it('shows which TonTuyau, as whom, the cookie as TonTuyau last said, and when it goes next', async () => {
    const fake = use(
      fakeExt({
        settings,
        tontuyau: { version: '1.5.0', name: 'Firefox, laptop (API key)' },
        lastSend: {
          at: minutesAgo(12),
          cookie: { receivedAt: '', receivedBy: '', state: 'works', checkedAt: null, reason: null },
        },
      }),
    )
    fake.alarms.set(alarmName, { delayInMinutes: 18, periodInMinutes: 30 })
    render(Popup)

    expect(await screen.findByRole('link', { name: 'tontuyau.example.net' })).toHaveAttribute(
      'href',
      'https://tontuyau.example.net',
    )
    expect(await screen.findByText('in 18 minutes (every 30 min)')).toBeInTheDocument()
    expect(screen.getByText(/· 1\.5\.0 · Firefox, laptop \(API key\)/)).toBeInTheDocument()
    expect(screen.getByText('Works')).toHaveClass('pill', 'works')
    expect(screen.getByText('12 minutes ago')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send the cookie now' })).toBeInTheDocument()
  })

  it('with several TonTuyau (0.3.0): a row each, what each said, and the send to all', async () => {
    const works = { receivedAt: '', receivedBy: '', state: 'works', checkedAt: null, reason: null }
    use(
      fakeExt({
        settings: {
          instances: [
            { id: 'a1', name: 'Home', url: 'https://tontuyau.example.net', apiKey: 'tt_a' },
            { id: 'b2', name: '', url: 'https://old.tontuyau.example', apiKey: 'tt_b' },
          ],
          everyMinutes: 30,
        },
        known: { a1: { version: '2.3.0', name: null, canAdd: true } },
        pumped: {
          at: minutesAgo(4),
          sends: {
            a1: { at: minutesAgo(4), cookie: works },
            b2: { at: minutesAgo(4), failure: 'unreachable', detail: 'connection refused' },
          },
        },
      }),
    )
    render(Popup)

    expect(await screen.findByText('4 minutes ago, to 1 of 2')).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0] as HTMLElement).getByText('Home')).toBeInTheDocument()
    expect(within(rows[0] as HTMLElement).getByText('Works')).toHaveClass('pill', 'works')
    expect(within(rows[1] as HTMLElement).getByText('old.tontuyau.example', { selector: 'b' })).toBeInTheDocument()
    expect(within(rows[1] as HTMLElement).getByText('Not sent')).toHaveClass('pill', 'refused')
    expect(within(rows[1] as HTMLElement).getByRole('alert')).toHaveTextContent("can't be reached: connection refused")
    expect(screen.getByRole('button', { name: 'Send the cookie now, to all' })).toBeInTheDocument()
  })

  it('sends the cookie now through the background, then shows what TonTuyau said', async () => {
    const fake = use(fakeExt({ settings }))
    fake.cookies.push(youTubeCookie())
    const refused = {
      receivedAt: '',
      receivedBy: '',
      state: 'refused',
      checkedAt: null,
      reason: 'Sign in to confirm',
    }
    startBackground(
      fake.ext,
      vi.fn(async () => new Response(JSON.stringify(refused))),
    )
    const user = userEvent.setup()
    render(Popup)

    expect(await screen.findByText(/never sent/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Send the cookie now' }))

    expect(await screen.findByText('Refused')).toHaveClass('pill', 'refused')
    expect(screen.getByRole('alert')).toHaveTextContent(/YouTube refused it: you're signed out/)
  })

  it.each([
    ['noCookie', undefined, /No YouTube cookie in this browser/],
    ['unreachable', 'NetworkError when attempting to fetch resource.', /can't be reached: NetworkError/],
    ['keyRefused', 'The API key is unknown or disabled.', /refused the API key/],
  ])('says why the last send failed (%s)', async (failure, detail, expected) => {
    use(fakeExt({ settings, lastSend: { at: minutesAgo(1), failure, detail } }))
    render(Popup)

    expect(await screen.findByRole('alert')).toHaveTextContent(expected)
  })
})
