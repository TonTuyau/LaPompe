// Chrome: a new version on the Chrome Web Store (its API v2, https://developer.chrome.com/docs/webstore/using-api).
//   1. a service account's access token (its JSON key: a JWT signed with its private key, exchanged at Google);
//   2. upload the zip, then look until the store processed it (its state while "in progress");
//   3. submit it for review, published by itself once approved (DEFAULT_PUBLISH).
// The service account is added once to the publisher (Developer Dashboard → Account), see docs/STORES.md.
import { answer, poll, sleep, type Fetch, type Log, type Sleep } from './http.ts'
import { rs256 } from './jwt.ts'

export const cwsApi = 'https://chromewebstore.googleapis.com'
export const cwsScope = 'https://www.googleapis.com/auth/chromewebstore'

export interface ChromeRelease {
  /** The service account's JSON key, as Google Cloud gives it. */
  serviceAccountKey: string
  /** Developer Dashboard → Account (Publisher ID), and the item's id (its URL in the store). */
  publisherId: string
  extensionId: string
  zip: { name: string; data: Blob }
}

interface ServiceAccountKey {
  client_email: string
  private_key: string
  token_uri?: string
}

interface UploadAnswer {
  uploadState?: string
  crxVersion?: string
}

interface StatusAnswer {
  lastAsyncUploadState?: string
}

interface PublishAnswer {
  state?: string
}

const inProgress = (state: string | undefined) => state === 'IN_PROGRESS' || state === 'UPLOAD_IN_PROGRESS'

/** Uploads the zip and submits it; returns the store's state for it (e.g. PENDING_REVIEW). */
export async function publishToChrome(
  release: ChromeRelease,
  fetchFn: Fetch = fetch,
  wait: Sleep = sleep,
  log: Log = console.log,
): Promise<string> {
  const key = JSON.parse(release.serviceAccountKey) as ServiceAccountKey
  const tokenUri = key.token_uri ?? 'https://oauth2.googleapis.com/token'
  const now = Math.floor(Date.now() / 1000)
  const assertion = rs256(
    { iss: key.client_email, scope: cwsScope, aud: tokenUri, iat: now, exp: now + 3600 },
    key.private_key,
  )
  const token = await answer<{ access_token: string }>(
    await fetchFn(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    }),
    'Google token',
  )
  const auth = `Bearer ${token.access_token}`
  const item = `publishers/${encodeURIComponent(release.publisherId)}/items/${encodeURIComponent(release.extensionId)}`

  const uploaded = await answer<UploadAnswer>(
    await fetchFn(`${cwsApi}/upload/v2/${item}:upload?uploadType=media`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/zip' },
      body: release.zip.data,
    }),
    'Chrome Web Store upload',
  )
  let state = uploaded.uploadState
  if (inProgress(state)) {
    log('Chrome Web Store: uploaded, being processed.')
    const status = await poll(
      async () =>
        answer<StatusAnswer>(
          await fetchFn(`${cwsApi}/v2/${item}:fetchStatus`, { headers: { Authorization: auth } }),
          'Chrome Web Store status',
        ),
      (answered) => !inProgress(answered.lastAsyncUploadState),
      { what: 'Chrome Web Store upload', tries: 120, every: 5000, wait },
    )
    state = status.lastAsyncUploadState
  }
  if (state !== 'SUCCEEDED') {
    throw new Error(`The Chrome Web Store didn't take the upload: ${state ?? 'no state'}.`)
  }
  log(`Chrome Web Store: ${release.zip.name} uploaded${uploaded.crxVersion ? ` (${uploaded.crxVersion})` : ''}.`)

  const published = await answer<PublishAnswer>(
    await fetchFn(`${cwsApi}/v2/${item}:publish`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH' }),
    }),
    'Chrome Web Store publish',
  )
  log(`Chrome Web Store: submitted (${published.state ?? 'no state'}); published once Google approves it.`)
  return published.state ?? ''
}
