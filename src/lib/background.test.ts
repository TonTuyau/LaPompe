import { fakeExt, youTubeCookie } from '../test/fakeExt'
import { alarmName, startBackground } from './background'

const settings = { url: 'https://tontuyau.example.net', apiKey: 'tt_k7Qm0042', everyMinutes: 30 }
const works = { receivedAt: 'x', receivedBy: 'y', state: 'works', checkedAt: null, reason: null }

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('background', () => {
  it('sets its alarm every N minutes once set up, the first send soon', async () => {
    const fake = fakeExt({ settings })
    startBackground(fake.ext, vi.fn())

    fake.events.onStartup.fire()
    await tick()

    expect(fake.alarms.get(alarmName)).toEqual({ delayInMinutes: 0.5, periodInMinutes: 30 })
  })

  it('sets no alarm before it is set up, and one once the settings are saved', async () => {
    const fake = fakeExt()
    startBackground(fake.ext, vi.fn())
    fake.events.onInstalled.fire()
    await tick()
    expect(fake.alarms.has(alarmName)).toBe(false)

    await fake.ext.storage.local.set({ settings: { ...settings, everyMinutes: 10 } })
    await tick()

    expect(fake.alarms.get(alarmName)).toEqual({ delayInMinutes: 0.5, periodInMinutes: 10 })
  })

  it('sends the cookie when its alarm rings', async () => {
    const fake = fakeExt({ settings })
    fake.cookies.push(youTubeCookie())
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(works)))
    startBackground(fake.ext, fetchFn)

    fake.ring(alarmName)
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1))
  })

  it('sends it when the popup asks, and answers with what TonTuyau said; one send at a time', async () => {
    const fake = fakeExt({ settings })
    fake.cookies.push(youTubeCookie())
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(works)))
    startBackground(fake.ext, fetchFn)

    const [first, second] = await Promise.all([fake.send({ type: 'pump' }), fake.send({ type: 'pump' })])

    expect(first).toMatchObject({ sends: { '1': { cookie: works } } })
    expect(second).toEqual(first)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it("asks the button's TonTuyau, by its id, where a video stands (0.3.0)", async () => {
    const home = { id: 'a1', name: 'Home', url: 'https://tontuyau.example.net', apiKey: 'tt_k7Qm0042' }
    const lucas = { id: 'b2', name: '', url: 'https://tube.lucas.example', apiKey: 'tt_Pq8s' }
    const fake = fakeExt({ settings: { instances: [home, lucas], everyMinutes: 30 } })
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ state: 'inTonTuyau', runId: null })))
    startBackground(fake.ext, fetchFn)

    const answer = await fake.send({ type: 'state', instance: 'b2', page: { kind: 'video', id: 'k3Fq8xZ0aQw' } })

    expect(answer).toEqual({ ok: true, item: { state: 'inTonTuyau', runId: null } })
    expect(fetchFn).toHaveBeenCalledWith(
      'https://tube.lucas.example/api/extension/videos/k3Fq8xZ0aQw',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(await fake.send({ type: 'add', instance: 'gone', page: { kind: 'video', id: 'k3Fq8xZ0aQw' } })).toEqual({
      ok: false,
      detail: "This TonTuyau is no longer in LaPompe's settings.",
    })
  })

  it('leaves other messages alone', () => {
    const fake = fakeExt({ settings })
    startBackground(fake.ext, vi.fn())

    expect(fake.events.onMessage.fire({ type: 'other' }, {}, () => {})).toEqual([false])
  })
})
