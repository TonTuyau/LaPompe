// What LaPompe asks TonTuyau (its /api/extension endpoints, TonTuyau 1.5): who it is, and the YouTube cookie. Every
// request carries the browser-extension API key (`Authorization: Bearer tt_…`).
import type { Settings } from './settings'

/** TonTuyau's answer to the connection test: its version, and the key's name ("Firefox, laptop (API key)"). */
export interface Connection {
  version: string
  name: string
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

/**
 * "Add to TonTuyau" (TonTuyau 1.6): queues a video for download, or subscribes TonTuyau to a channel. Provisional:
 * TonTuyau 1.6 defines these endpoints (its PR B7); LaPompe calls them only once TonTuyau says 1.6 or later.
 */
export async function add(
  settings: Settings,
  page: { kind: 'video' | 'channel'; id: string },
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const path = page.kind === 'video' ? 'videos' : 'channels'
  await call<unknown>(settings, 'POST', `/api/extension/${path}/${encodeURIComponent(page.id)}`, {}, fetchFn)
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
