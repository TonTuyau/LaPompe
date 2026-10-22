// Firefox: a new listed version on addons.mozilla.org (AMO's API v5, https://mozilla.github.io/addons-server/).
//   1. upload the add-on's zip (channel "listed"), then look until AMO's validator processed it: refused if invalid;
//   2. make the version from that upload, with its licence and its release notes (English);
//   3. attach the source package (the code is built: Mozilla's reviewers rebuild it, docs/BUILD.md). AMO takes the
//      source only as a file of its own request, not with the notes.
// Then it's in Mozilla's review queue, as when it's submitted by hand.
import { randomUUID } from 'node:crypto'
import { answer, poll, sleep, type Fetch, type Log, type Sleep } from './http.ts'
import { hs256 } from './jwt.ts'

export const amoApi = 'https://addons.mozilla.org/api/v5'

export interface AmoRelease {
  /** The API key's issuer and secret (AMO → Developer Hub → Manage API keys). */
  issuer: string
  secret: string
  /** The add-on's id in its manifest (browser_specific_settings.gecko.id). */
  addonId: string
  zip: { name: string; data: Blob }
  source: { name: string; data: Blob }
  /**
   * The version's licence, a custom one: AMO's own licences have the GPL 3 "only", not "or later" (the version
   * inherits the one before when it's left out, MIT up to 0.2.0).
   */
  license: { name: string; text: string }
  /** The version's notes; null: none. */
  notes: string | null
}

interface Upload {
  uuid: string
  processed: boolean
  valid: boolean
  validation?: { messages?: { type?: string; message?: string }[] } | null
}

interface Version {
  id: number
  version: string
}

/**
 * Checks the credentials without changing anything (`--check`): the API key's account, and the add-on's version on
 * AMO as that account sees it.
 */
export async function checkAmo(
  release: Pick<AmoRelease, 'issuer' | 'secret' | 'addonId'>,
  fetchFn: Fetch = fetch,
  log: Log = console.log,
): Promise<string> {
  const auth = () => {
    const now = Math.floor(Date.now() / 1000)
    return `JWT ${hs256({ iss: release.issuer, jti: randomUUID(), iat: now, exp: now + 60 }, release.secret)}`
  }
  const account = await answer<{ username?: string; name?: string }>(
    await fetchFn(`${amoApi}/accounts/profile/`, { headers: { Authorization: auth() } }),
    'AMO account',
  )
  const addon = await answer<{ current_version?: { version?: string } | null }>(
    await fetchFn(`${amoApi}/addons/addon/${encodeURIComponent(release.addonId)}/`, {
      headers: { Authorization: auth() },
    }),
    'AMO add-on',
  )
  const version = addon.current_version?.version ?? 'none yet'
  log(`AMO: signed in as ${account.name || account.username || '?'}; ${release.addonId} is at ${version}.`)
  return version
}

/** Uploads, validates and submits the version. */
export async function publishToAmo(
  release: AmoRelease,
  fetchFn: Fetch = fetch,
  wait: Sleep = sleep,
  log: Log = console.log,
): Promise<Version> {
  // A token each call: AMO takes them for a minute at most.
  const auth = () => {
    const now = Math.floor(Date.now() / 1000)
    return `JWT ${hs256({ iss: release.issuer, jti: randomUUID(), iat: now, exp: now + 60 }, release.secret)}`
  }
  const addon = `${amoApi}/addons/addon/${encodeURIComponent(release.addonId)}`

  const form = new FormData()
  form.append('upload', release.zip.data, release.zip.name)
  form.append('channel', 'listed')
  const uploaded = await answer<Upload>(
    await fetchFn(`${amoApi}/addons/upload/`, { method: 'POST', headers: { Authorization: auth() }, body: form }),
    'AMO upload',
  )
  log(`AMO: ${release.zip.name} uploaded (${uploaded.uuid}), waiting for the validator.`)

  const checked = await poll(
    async () =>
      answer<Upload>(
        await fetchFn(`${amoApi}/addons/upload/${uploaded.uuid}/`, { headers: { Authorization: auth() } }),
        'AMO upload status',
      ),
    (upload) => upload.processed,
    { what: 'AMO validation', tries: 120, every: 5000, wait },
  )
  if (!checked.valid) {
    const errors = (checked.validation?.messages ?? [])
      .filter((message) => message.type === 'error')
      .map((message) => message.message ?? '?')
    throw new Error(`AMO refused the upload: ${errors.join(' | ') || 'invalid, without a message'}`)
  }

  const version = await answer<Version>(
    await fetchFn(`${addon}/versions/`, {
      method: 'POST',
      headers: { Authorization: auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload: uploaded.uuid,
        custom_license: { name: { 'en-US': release.license.name }, text: { 'en-US': release.license.text } },
        ...(release.notes ? { release_notes: { 'en-US': release.notes } } : {}),
      }),
    }),
    'AMO version',
  )
  log(`AMO: version ${version.version} made (${version.id}).`)

  const source = new FormData()
  source.append('source', release.source.data, release.source.name)
  await answer<unknown>(
    await fetchFn(`${addon}/versions/${version.id}/`, {
      method: 'PATCH',
      headers: { Authorization: auth() },
      body: source,
    }),
    'AMO source',
  )
  log(`AMO: ${release.source.name} attached; version ${version.version} is in Mozilla's review.`)
  return version
}
