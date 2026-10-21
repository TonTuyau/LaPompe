// What LaPompe asks TonTuyau (its /api/extension endpoints): who it is and whether it adds (2.0), the YouTube cookie
// (1.5), and where a video or channel stands, adding it (2.0). Every request carries the browser-extension API key
// (`Authorization: Bearer tt_…`).
import type { Settings } from './settings'

/**
 * TonTuyau's answer to the connection test: its version, the key's name ("Firefox, laptop (API key)"), and whether it
 * takes "Add to TonTuyau" (2.0; absent before, read as no).
 */
export interface Connection {
  version: string
  name: string
  canAdd?: boolean
}

/**
 * Where a video or channel stands in TonTuyau: absent (it can be added), fileMissing (a video it has without its file:
 * adding it downloads the file), waiting (its run is in TonTuyau's queue, going on or on hold), inTonTuyau (a video
 * with its file, a channel subscribed to).
 */
export interface Item {
  state: 'absent' | 'fileMissing' | 'waiting' | 'inTonTuyau'
  runId: string | null
}

/** A YouTube page's video or channel, by its id. */
export interface Page {
  kind: 'video' | 'channel'
  id: string
}

/** The YouTube cookie as TonTuyau has it (never its content): whether YouTube took it. */
export interface CookieState {
  receivedAt: string
  receivedBy: string
  state: 'works' | 'refused' | 'unchecked'
  checkedAt: string | null
  reason: string | null
}

export type Failure = 'unreachable' | 'keyRefused' | 'keyNotAllowed' | 'refused' | 'unexpected'

/** A request TonTuyau didn't answer as expected; `detail` is TonTuyau's own words when it gave some. */
export class TonTuyauError extends Error {
  constructor(
    readonly failure: Failure,
    readonly detail: string,
    readonly status?: number,
  ) {
    super(detail)
    this.name = 'TonTuyauError'
  }
}

/** The header every TonTuyau answer carries with its version. */
export const versionHeader = 'X-TonTuyau-Version'

export async function connect(settings: Settings, fetchFn: typeof fetch = fetch): Promise<Connection> {
  const { body } = await call<Connection>(settings, 'GET', '/api/extension/connection', undefined, fetchFn)
  return body
}

/** Sends the cookie file; TonTuyau checks it with YouTube at once (a few seconds), then answers. */
export async function sendCookie(
  settings: Settings,
  cookies: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ cookie: CookieState; version: string | null }> {
  const { body, version } = await call<CookieState>(
    settings,
    'PUT',
    '/api/extension/youtube-cookie',
    { cookies },
    fetchFn,
  )
  return { cookie: body, version }
}

const itemPath = (page: Page) =>
  `/api/extension/${page.kind === 'video' ? 'videos' : 'channels'}/${encodeURIComponent(page.id)}`

/** Where the video or channel stands in TonTuyau (2.0, only once TonTuyau says it can add). */
export async function itemState(settings: Settings, page: Page, fetchFn: typeof fetch = fetch): Promise<Item> {
  const { body } = await call<Item>(settings, 'GET', itemPath(page), undefined, fetchFn)
  return body
}

/**
 * "Add to TonTuyau" (2.0): queues the video's download, or subscribes TonTuyau to the channel (with its default tabs);
 * one already waiting answers with its run. TonTuyau refuses (409) what it has already.
 */
export async function add(settings: Settings, page: Page, fetchFn: typeof fetch = fetch): Promise<Item> {
  const { body } = await call<Item>(settings, 'POST', itemPath(page), undefined, fetchFn)
  return body
}

async function call<T>(
  settings: Settings,
  method: string,
  path: string,
  body: unknown,
  fetchFn: typeof fetch,
): Promise<{ body: T; version: string | null }> {
  let response: Response
  try {
    response = await fetchFn(settings.url + path, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'omit',
      cache: 'no-store',
    })
  } catch (error) {
    throw new TonTuyauError('unreachable', error instanceof Error ? error.message : String(error))
  }

  if (response.ok) {
    // A 202 or 204 may come without a body.
    const text = await response.text()
    return { body: (text === '' ? null : JSON.parse(text)) as T, version: response.headers.get(versionHeader) }
  }

  const detail = await problemDetail(response)
  const failure: Failure =
    response.status === 401
      ? 'keyRefused'
      : response.status === 403
        ? 'keyNotAllowed'
        : response.status === 400
          ? 'refused'
          : 'unexpected'
  throw new TonTuyauError(failure, detail, response.status)
}

/** TonTuyau's words for a refusal (its problem's detail, or its first validation error), else the status. */
async function problemDetail(response: Response): Promise<string> {
  try {
    const problem = (await response.json()) as { detail?: string; title?: string; errors?: Record<string, string[]> }
    const firstError = problem.errors ? Object.values(problem.errors).flat()[0] : undefined
    return problem.detail ?? firstError ?? problem.title ?? `HTTP ${response.status}`
  } catch {
    return `HTTP ${response.status}`
  }
}
