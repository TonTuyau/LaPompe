import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { loadKnownTonTuyau } from '../lib/pump'
import { loadSettings } from '../lib/settings'
import { fakeExt, type FakeExt } from '../test/fakeExt'
import Options from './Options.svelte'

function use(fake: FakeExt): FakeExt {
  ;(globalThis as { chrome?: typeof chrome }).chrome = fake.ext
  return fake
}

async function fill(user: ReturnType<typeof userEvent.setup>, url: string, key: string, every = '30') {
  await user.clear(await screen.findByLabelText("TonTuyau's address"))
  await user.type(screen.getByLabelText("TonTuyau's address"), url)
  await user.clear(screen.getByLabelText('API key'))
  await user.type(screen.getByLabelText('API key'), key)
  await user.clear(screen.getByLabelText('Send the YouTube cookie every'))
  await user.type(screen.getByLabelText('Send the YouTube cookie every'), every)
}

describe('Options', () => {
  it('saves the settings once the browser lets LaPompe reach that address and youtube.com', async () => {
    const fake = use(fakeExt())
    const user = userEvent.setup()
    render(Options)

    await fill(user, 'https://tontuyau.example.net/admin', 'tt_k7Qm0042', '15')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Saved.')
    expect(fake.ext.permissions.request).toHaveBeenCalledWith({
      origins: ['https://tontuyau.example.net/*', '*://*.youtube.com/*'],
    })
    expect(await loadSettings(fake.ext.storage.local)).toEqual({
      url: 'https://tontuyau.example.net',
      apiKey: 'tt_k7Qm0042',
      everyMinutes: 15,
    })
    expect(screen.getByLabelText("TonTuyau's address")).toHaveValue('https://tontuyau.example.net')
  })

  it('shows the settings saved before', async () => {
    use(fakeExt({ settings: { url: 'http://192.168.1.40:8080', apiKey: 'tt_abc', everyMinutes: 60 } }))
    render(Options)

    expect(await screen.findByDisplayValue('http://192.168.1.40:8080')).toBeInTheDocument()
    expect(screen.getByLabelText('Send the YouTube cookie every')).toHaveValue(60)
  })

  it('says what is wrong before asking anything', async () => {
    const fake = use(fakeExt())
    const user = userEvent.setup()
    render(Options)

    await fill(user, 'tontuyau', 'a password', '2')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const alerts = screen.getAllByRole('alert').map((a) => a.textContent)
    expect(alerts).toEqual([
      'An address like https://tontuyau.example.net.',
      'A TonTuyau API key starts with tt_.',
      'A whole number, 5 or more.',
    ])
    expect(fake.ext.permissions.request).not.toHaveBeenCalled()
  })

  it('saves nothing when the browser is refused leave', async () => {
    const fake = use(fakeExt())
    ;(fake.ext.permissions.request as unknown as Mock).mockResolvedValue(false)
    const user = userEvent.setup()
    render(Options)

    await fill(user, 'https://tontuyau.example.net', 'tt_k7Qm0042')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      "Without your leave, LaPompe can't reach https://tontuyau.example.net.",
    )
    expect((await loadSettings(fake.ext.storage.local)).url).toBe('')
  })

  it("tests the connection: TonTuyau's version and the key's name, kept for the popup", async () => {
    const fake = use(fakeExt())
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ version: '1.5.0', name: 'Firefox, laptop (API key)' })))
    const user = userEvent.setup()
    render(Options)

    await fill(user, 'https://tontuyau.example.net', 'tt_k7Qm0042')
    await user.click(screen.getByRole('button', { name: 'Test the connection' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Connected: TonTuyau 1.5.0, as "Firefox, laptop (API key)".',
    )
    expect(fetchSpy).toHaveBeenCalledWith('https://tontuyau.example.net/api/extension/connection', expect.anything())
    expect(await loadKnownTonTuyau(fake.ext.storage.local)).toEqual({
      version: '1.5.0',
      name: 'Firefox, laptop (API key)',
    })
  })

  it('says why the connection test failed', async () => {
    use(fakeExt())
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'The API key is unknown or disabled.' }), { status: 401 }),
    )
    const user = userEvent.setup()
    render(Options)

    await fill(user, 'https://tontuyau.example.net', 'tt_k7Qm0042')
    await user.click(screen.getByRole('button', { name: 'Test the connection' }))

    expect(await screen.findByRole('status')).toHaveTextContent('TonTuyau refused the API key')
  })
})
