// @vitest-environment node
import { createHmac, createVerify, generateKeyPairSync } from 'node:crypto'
import { amoApi, checkAmo, publishToAmo, type AmoRelease } from './amo.ts'
import { checkChrome, cwsApi, cwsScope, publishToChrome, type ChromeRelease } from './chrome.ts'

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body: RequestInit['body']
}

/** A fake store: each call is recorded and answered by the next of `answers` (status, JSON). */
function store(answers: [number, unknown][]) {
  const calls: Call[] = []
  const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: init?.body,
    })
    const [status, json] = answers.shift() ?? [500, { detail: 'no more answers' }]
    return new Response(JSON.stringify(json), { status })
  }) as unknown as typeof fetch
  return { calls, fetchFn }
}

const noWait = async () => {}
const quiet = () => {}
const claimsOf = (token: string) =>
  JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as Record<string, unknown>

describe('Firefox (AMO)', () => {
  const release: AmoRelease = {
    issuer: 'user:12345:67',
    secret: 'the-secret',
    addonId: 'tontuyau@lapompe',
    zip: { name: 'lapompe-0.1.5-firefox.zip', data: new Blob(['zip']) },
    source: { name: 'lapompe-0.1.5-source.zip', data: new Blob(['source']) },
    notes: '- The channel button.',
  }

  it('uploads, waits for the validator, makes the version with its notes, then attaches the source', async () => {
    const { calls, fetchFn } = store([
      [201, { uuid: 'u-1', processed: false, valid: false }],
      [200, { uuid: 'u-1', processed: false, valid: false }],
      [200, { uuid: 'u-1', processed: true, valid: true }],
      [201, { id: 7, version: '0.1.5' }],
      [200, { id: 7 }],
    ])

    expect(await publishToAmo(release, fetchFn, noWait, quiet)).toEqual({ id: 7, version: '0.1.5' })

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `POST ${amoApi}/addons/upload/`,
      `GET ${amoApi}/addons/upload/u-1/`,
      `GET ${amoApi}/addons/upload/u-1/`,
      `POST ${amoApi}/addons/addon/tontuyau%40lapompe/versions/`,
      `PATCH ${amoApi}/addons/addon/tontuyau%40lapompe/versions/7/`,
    ])
    const upload = calls[0]?.body as FormData
    expect(upload.get('channel')).toBe('listed')
    expect((upload.get('upload') as File).name).toBe('lapompe-0.1.5-firefox.zip')
    expect(JSON.parse(String(calls[3]?.body))).toEqual({
      upload: 'u-1',
      release_notes: { 'en-US': '- The channel button.' },
    })
    expect(((calls[4]?.body as FormData).get('source') as File).name).toBe('lapompe-0.1.5-source.zip')

    // Each call its own token, signed with the secret, for a minute.
    for (const call of calls) {
      const token = call.headers.authorization?.replace(/^JWT /, '') ?? ''
      const [header, claims, signature] = token.split('.')
      expect(createHmac('sha256', 'the-secret').update(`${header}.${claims}`).digest('base64url')).toBe(signature)
      const read = claimsOf(token)
      expect(read.iss).toBe('user:12345:67')
      expect(Number(read.exp) - Number(read.iat)).toBe(60)
    }
  })

  it('stops when the validator refuses the upload, saying why', async () => {
    const { calls, fetchFn } = store([
      [201, { uuid: 'u-2', processed: true, valid: false }],
      [
        200,
        {
          uuid: 'u-2',
          processed: true,
          valid: false,
          validation: { messages: [{ type: 'error', message: 'Duplicate add-on ID found.' }, { type: 'warning' }] },
        },
      ],
    ])

    await expect(publishToAmo(release, fetchFn, noWait, quiet)).rejects.toThrow(
      'AMO refused the upload: Duplicate add-on ID found.',
    )
    expect(calls).toHaveLength(2)
  })

  it('checks the credentials without uploading: the account, and the version AMO has', async () => {
    const { calls, fetchFn } = store([
      [200, { username: 'eclegv', name: 'Eclegv' }],
      [200, { current_version: { version: '0.1.4' } }],
    ])

    expect(await checkAmo(release, fetchFn, quiet)).toBe('0.1.4')
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `GET ${amoApi}/accounts/profile/`,
      `GET ${amoApi}/addons/addon/tontuyau%40lapompe/`,
    ])
    expect(calls.every((call) => call.headers.authorization?.startsWith('JWT '))).toBe(true)
  })

  it('says what AMO answered on an error, never the secret', async () => {
    const { fetchFn } = store([[401, { detail: 'Incorrect authentication credentials.' }]])

    const failed = publishToAmo(release, fetchFn, noWait, quiet)
    await expect(failed).rejects.toThrow(/^AMO upload: 401 .*Incorrect authentication credentials/)
    await expect(failed).rejects.not.toThrow('the-secret')
  })
})

describe('Chrome (Chrome Web Store)', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const release: ChromeRelease = {
    serviceAccountKey: JSON.stringify({
      client_email: 'lapompe@project.iam.gserviceaccount.com',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
      token_uri: 'https://oauth2.googleapis.com/token',
    }),
    publisherId: 'pub-1',
    extensionId: 'abcdefghijklmnopabcdefghijklmnop',
    zip: { name: 'lapompe-0.1.5-chrome.zip', data: new Blob(['zip']) },
  }
  const item = `${cwsApi}/v2/publishers/pub-1/items/abcdefghijklmnopabcdefghijklmnop`

  it("gets the service account's token, uploads, waits while it's processed, then submits it to publish", async () => {
    const { calls, fetchFn } = store([
      [200, { access_token: 'token-1' }],
      [200, { uploadState: 'IN_PROGRESS' }],
      [200, { lastAsyncUploadState: 'IN_PROGRESS' }],
      [200, { lastAsyncUploadState: 'SUCCEEDED' }],
      [200, { state: 'PENDING_REVIEW' }],
    ])

    expect(await publishToChrome(release, fetchFn, noWait, quiet)).toBe('PENDING_REVIEW')

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST https://oauth2.googleapis.com/token',
      `POST ${cwsApi}/upload/v2/publishers/pub-1/items/abcdefghijklmnopabcdefghijklmnop:upload?uploadType=media`,
      `GET ${item}:fetchStatus`,
      `GET ${item}:fetchStatus`,
      `POST ${item}:publish`,
    ])
    const grant = new URLSearchParams(String(calls[0]?.body))
    expect(grant.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer')
    const assertion = grant.get('assertion') ?? ''
    const [header, claims, signature] = assertion.split('.')
    expect(
      createVerify('RSA-SHA256')
        .update(`${header}.${claims}`)
        .verify(publicKey, signature ?? '', 'base64url'),
    ).toBe(true)
    expect(claimsOf(assertion)).toMatchObject({
      iss: 'lapompe@project.iam.gserviceaccount.com',
      scope: cwsScope,
      aud: 'https://oauth2.googleapis.com/token',
    })
    expect(calls[1]?.headers).toMatchObject({ authorization: 'Bearer token-1', 'content-type': 'application/zip' })
    expect(JSON.parse(String(calls[4]?.body))).toEqual({ publishType: 'DEFAULT_PUBLISH' })
  })

  it('checks the credentials without uploading: the token, and the version the publisher sees', async () => {
    const { calls, fetchFn } = store([
      [200, { access_token: 'token-1' }],
      [200, { publishedItemRevisionStatus: { state: 'PUBLISHED', distributionChannels: [{ crxVersion: '0.1.4' }] } }],
    ])

    expect(await checkChrome(release, fetchFn, quiet)).toBe('0.1.4')
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST https://oauth2.googleapis.com/token',
      `GET ${item}:fetchStatus`,
    ])
  })

  it("doesn't submit an upload the store didn't take", async () => {
    const { calls, fetchFn } = store([
      [200, { access_token: 'token-1' }],
      [200, { uploadState: 'FAILED' }],
    ])

    await expect(publishToChrome(release, fetchFn, noWait, quiet)).rejects.toThrow(
      "The Chrome Web Store didn't take the upload: FAILED.",
    )
    expect(calls).toHaveLength(2)
  })
})
