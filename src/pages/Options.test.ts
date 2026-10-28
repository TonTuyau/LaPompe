import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { loadKnown } from '../lib/pump'
import { loadSettings } from '../lib/settings'
import { fakeExt, type FakeExt } from '../test/fakeExt'
import Options from './Options.svelte'

const home = { id: 'a1', name: 'Home', url: 'https://tontuyau.example.net', apiKey: 'tt_k7Qm0042' }
const lucas = { id: 'b2', name: '', url: 'https://tube.lucas.example', apiKey: 'tt_Pq8s' }

function use(fake: FakeExt): FakeExt {
  ;(globalThis as { chrome?: typeof chrome }).chrome = fake.ext
  return fake
}

type User = ReturnType<typeof userEvent.setup>

/** The card of the n-th TonTuyau (from 0). */
const card = async (n: number) => within((await screen.findAllByRole('group'))[n] as HTMLElement)

async function fill(user: User, n: number, url: string, key: string, name = '') {
  const inside = await card(n)
  await user.clear(inside.getByLabelText('Address'))
  await user.type(inside.getByLabelText('Address'), url)
  await user.clear(inside.getByLabelText('API key'))
  await user.type(inside.getByLabelText('API key'), key)
  await user.clear(inside.getByLabelText(/^Name/))
  if (name !== '') await user.type(inside.getByLabelText(/^Name/), name)
}

async function every(user: User, minutes: string) {
  await user.clear(screen.getByLabelText('Send the YouTube cookie every'))
  await user.type(screen.getByLabelText('Send the YouTube cookie every'), minutes)
}

describe('Options', () => {
  it('saves a first TonTuyau once the browser lets LaPompe reach that address and youtube.com', async () => {
    const fake = use(fakeExt())
    const user = userEvent.setup()
    render(Options)

    await fill(user, 0, 'https://tontuyau.example.net/admin', 'tt_k7Qm0042')
    await every(user, '15')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Saved.')).toBeInTheDocument()
    expect(fake.ext.permissions.request).toHaveBeenCalledWith({
      origins: ['https://tontuyau.example.net/*', '*://*.youtube.com/*'],
    })
    expect(await loadSettings(fake.ext.storage.local)).toEqual({
      instances: [{ id: expect.any(String), name: '', url: 'https://tontuyau.example.net', apiKey: 'tt_k7Qm0042' }],
      everyMinutes: 15,
    })
    expect((await card(0)).getByLabelText('Address')).toHaveValue('https://tontuyau.example.net')
  })

  it("shows 0.2.0's TonTuyau as the first one, and warns the cookie goes to every TonTuyau listed", async () => {
    use(fakeExt({ settings: { url: 'http://192.168.1.40:8080', apiKey: 'tt_abc', everyMinutes: 60 } }))
    render(Options)

    expect(await screen.findByDisplayValue('http://192.168.1.40:8080')).toBeInTheDocument()
    expect(screen.getByText('1 instance')).toBeInTheDocument()
    expect(screen.getByLabelText('Send the YouTube cookie every')).toHaveValue(60)
    expect(screen.getByText('Your YouTube cookie goes to every TonTuyau listed here.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('adds a second TonTuyau with a name of its own; both are saved, each address asked for', async () => {
    const fake = use(fakeExt({ settings: { instances: [home], everyMinutes: 30 } }))
    const user = userEvent.setup()
    render(Options)
    await screen.findByDisplayValue(home.url)

    await user.click(screen.getByRole('button', { name: 'Add a TonTuyau' }))
    expect(within((await screen.findAllByRole('group'))[1] as HTMLElement).getByText('New TonTuyau')).toBeVisible()
    await fill(user, 1, 'https://tube.lucas.example', 'tt_Pq8s', 'Lucas')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Saved.')).toBeInTheDocument()
    expect(fake.ext.permissions.request).toHaveBeenCalledWith({
      origins: ['https://tontuyau.example.net/*', 'https://tube.lucas.example/*', '*://*.youtube.com/*'],
    })
    expect((await loadSettings(fake.ext.storage.local)).instances).toEqual([
      home,
      { id: expect.any(String), name: 'Lucas', url: 'https://tube.lucas.example', apiKey: 'tt_Pq8s' },
    ])
    expect(screen.getByText('2 instances')).toBeInTheDocument()
  })

  it('removes a TonTuyau: gives its address back to the browser, forgets what it knew of it', async () => {
    const fake = use(
      fakeExt({
        settings: { instances: [home, lucas], everyMinutes: 30 },
        known: {
          a1: { version: '2.3.0', name: null, canAdd: true },
          b2: { version: '2.2.0', name: null, canAdd: true },
        },
      }),
    )
    const user = userEvent.setup()
    render(Options)

    await user.click((await card(1)).getByRole('button', { name: 'Remove' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Saved.')).toBeInTheDocument()
    expect((await loadSettings(fake.ext.storage.local)).instances).toEqual([home])
    expect(fake.ext.permissions.remove).toHaveBeenCalledWith({ origins: ['https://tube.lucas.example/*'] })
    expect(await loadKnown(fake.ext.storage.local)).toEqual({ a1: { version: '2.3.0', name: null, canAdd: true } })
  })

  it('says what is wrong before asking anything, under the TonTuyau it is about', async () => {
    const fake = use(fakeExt({ settings: { instances: [home], everyMinutes: 30 } }))
    const user = userEvent.setup()
    render(Options)
    await screen.findByDisplayValue(home.url)

    await user.click(screen.getByRole('button', { name: 'Add a TonTuyau' }))
    await fill(user, 1, 'https://tontuyau.example.net/', 'a password')
    await every(user, '2')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      within((await screen.findAllByRole('group'))[1] as HTMLElement)
        .getAllByRole('alert')
        .map((a) => a.textContent),
    ).toEqual(['This TonTuyau is already in the list.', 'A TonTuyau API key starts with tt_.'])
    expect(screen.getByText('A whole number, 5 or more.')).toBeInTheDocument()
    expect(fake.ext.permissions.request).not.toHaveBeenCalled()
  })

  it('saves nothing when the browser is refused leave', async () => {
    const fake = use(fakeExt())
    ;(fake.ext.permissions.request as unknown as Mock).mockResolvedValue(false)
    const user = userEvent.setup()
    render(Options)

    await fill(user, 0, 'https://tontuyau.example.net', 'tt_k7Qm0042')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      "Without your leave, LaPompe can't reach these addresses: nothing was saved.",
    )
    expect((await loadSettings(fake.ext.storage.local)).instances).toEqual([])
  })

  it("tests one TonTuyau's connection: its version and the key's name, kept for it once saved", async () => {
    const fake = use(fakeExt())
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ version: '2.3.0', name: 'Firefox, laptop (API key)', canAdd: true })),
      )
    const user = userEvent.setup()
    render(Options)

    await fill(user, 0, 'https://tontuyau.example.net', 'tt_k7Qm0042')
    await user.click(screen.getByRole('button', { name: 'Test the connection' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Connected: TonTuyau 2.3.0, as "Firefox, laptop (API key)".',
    )
    expect(fetchSpy).toHaveBeenCalledWith('https://tontuyau.example.net/api/extension/connection', expect.anything())
    expect(await screen.findByText('· TonTuyau 2.3.0')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Saved.')

    const [saved] = (await loadSettings(fake.ext.storage.local)).instances
    expect(await loadKnown(fake.ext.storage.local)).toEqual({
      [saved?.id ?? '']: { version: '2.3.0', name: 'Firefox, laptop (API key)', canAdd: true },
    })
  })

  it('says why the connection test failed', async () => {
    use(fakeExt())
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'The API key is unknown or disabled.' }), { status: 401 }),
    )
    const user = userEvent.setup()
    render(Options)

    await fill(user, 0, 'https://tontuyau.example.net', 'tt_k7Qm0042')
    await user.click(screen.getByRole('button', { name: 'Test the connection' }))

    expect(await screen.findByRole('status')).toHaveTextContent('TonTuyau refused the API key')
  })
})
