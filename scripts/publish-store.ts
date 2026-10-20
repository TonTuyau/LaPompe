// Publishes the built version to one store: node scripts/publish-store.ts <firefox|chrome> [--dry-run | --check]
// The version is package.json's; its zips are dist/'s (pnpm run build, and the release workflow's source package);
// its notes docs/releases/<version>.md. The stores' credentials come from the environment (the release workflow's
// `stores` environment, docs/STORES.md); --dry-run checks the files and that each credential is there, says what it
// would send, and sends nothing; --check signs in to the store and reads the add-on's version there, without a file
// and without changing anything (the "Store credentials" workflow).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { firefoxId } from './manifest.ts'
import { checkAmo, publishToAmo } from './stores/amo.ts'
import { checkChrome, publishToChrome } from './stores/chrome.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const version: string = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
const [store, ...flags] = process.argv.slice(2)
const dryRun = flags.includes('--dry-run')
const check = flags.includes('--check')

const credentials: Record<string, string[]> = {
  firefox: ['AMO_JWT_ISSUER', 'AMO_JWT_SECRET'],
  chrome: ['CWS_SERVICE_ACCOUNT_KEY', 'CWS_PUBLISHER_ID', 'CWS_EXTENSION_ID'],
}
const needed = store === undefined ? undefined : credentials[store]
if (needed === undefined) {
  console.error('Usage: node scripts/publish-store.ts <firefox|chrome> [--dry-run | --check]')
  process.exit(2)
}

function file(name: string): { name: string; data: Blob } {
  const path = join(root, 'dist', name)
  if (!existsSync(path)) {
    console.error(`${path} isn't there: build it first (pnpm run build; the source package: the release workflow).`)
    process.exit(1)
  }
  return { name, data: new Blob([readFileSync(path)]) }
}

/** Names the missing ones, never the values. */
const missing = needed.filter((name) => !process.env[name])
if (missing.length > 0) {
  console.error(`Missing: ${missing.join(', ')} (the stores environment's secrets, docs/STORES.md).`)
  process.exit(1)
}

const env = (name: string) => process.env[name] ?? ''
const notesFile = join(root, 'docs', 'releases', `${version}.md`)
const notes = existsSync(notesFile) ? readFileSync(notesFile, 'utf8').trim() : null

if (check) {
  if (store === 'firefox') {
    await checkAmo({ issuer: env('AMO_JWT_ISSUER'), secret: env('AMO_JWT_SECRET'), addonId: firefoxId })
  } else {
    await checkChrome({
      serviceAccountKey: env('CWS_SERVICE_ACCOUNT_KEY'),
      publisherId: env('CWS_PUBLISHER_ID'),
      extensionId: env('CWS_EXTENSION_ID'),
    })
  }
} else if (store === 'firefox') {
  const zip = file(`lapompe-${version}-firefox.zip`)
  const source = file(`lapompe-${version}-source.zip`)
  if (dryRun) {
    console.log(
      `Dry run: ${firefoxId} ${version} to AMO (listed), ${zip.name} + ${source.name}, notes: ${notes ? 'yes' : 'none'}.`,
    )
  } else {
    await publishToAmo({
      issuer: env('AMO_JWT_ISSUER'),
      secret: env('AMO_JWT_SECRET'),
      addonId: firefoxId,
      zip,
      source,
      notes,
    })
  }
} else {
  const zip = file(`lapompe-${version}-chrome.zip`)
  if (dryRun) {
    // The key must at least read as a service account's.
    const key = JSON.parse(env('CWS_SERVICE_ACCOUNT_KEY')) as { client_email?: string; private_key?: string }
    if (!key.client_email || !key.private_key) {
      console.error("CWS_SERVICE_ACCOUNT_KEY isn't a service account's JSON key (no client_email or private_key).")
      process.exit(1)
    }
    console.log(
      `Dry run: ${version} to the Chrome Web Store as ${key.client_email}, ${zip.name}, published once approved.`,
    )
  } else {
    await publishToChrome({
      serviceAccountKey: env('CWS_SERVICE_ACCOUNT_KEY'),
      publisherId: env('CWS_PUBLISHER_ID'),
      extensionId: env('CWS_EXTENSION_ID'),
      zip,
    })
  }
}
