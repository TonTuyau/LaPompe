# LaPompe

_LaPompe remplit TonTuyau._

[TonTuyau](https://github.com/TonTuyau/TonTuyau)'s browser extension, for Firefox and Chrome: it sends your YouTube
cookie to TonTuyau, so TonTuyau reads YouTube signed in, and (with TonTuyau 1.6) adds "Add to TonTuyau" buttons to
YouTube's pages.

## What it does

- **Sends your YouTube cookie to TonTuyau** every N minutes (30 by default, 5 at least), and when you click "Send the
  cookie now" in its popup: only the `youtube.com` cookies, as a Netscape cookie file, to
  `PUT /api/extension/youtube-cookie` with a TonTuyau API key of kind "browser extension". TonTuyau checks it at once
  with YouTube; the popup shows what it answered (works, refused, not checked) and when it's sent next. YouTube renews
  its cookies while you browse: sending them often keeps TonTuyau's copy working.
- **"Add to TonTuyau" on YouTube's pages**, next to Subscribe: on a video's page, and "Add channel to TonTuyau" on a
  channel's. Disabled until TonTuyau says 1.6 or later (the version that downloads); its tooltip says why. With 1.6, a
  click calls `POST /api/extension/videos/{id}` or `POST /api/extension/channels/{id}`: **provisional**, to match what
  TonTuyau 1.6 defines.

What it asks the browser for: `cookies` and `youtube.com` (to read the YouTube cookie, and to put its buttons on
YouTube's pages), `storage` (its settings, in the extension's own storage), `alarms` (to send every N minutes), and
your TonTuyau's address only, when you save it in its settings (no other site). Firefox asks for the hosts when you
save the settings too.

## Setting it up

1. In TonTuyau: Admin → API keys → New key, of kind "Browser extension". Copy its secret (shown once).
2. In LaPompe's settings (its toolbar button → Settings): TonTuyau's address and that key, then Save (the browser asks
   once to let LaPompe reach that address and youtube.com), and Test the connection.
3. Be signed in on youtube.com in this browser.

## Privacy, license

LaPompe sends your youtube.com cookies to the TonTuyau address you set, and nowhere else: see
[PRIVACY.md](PRIVACY.md). It's free software under the [MIT license](LICENSE).

## Releases

Each version tag `vX.Y.Z` runs the full checks on its source, then publishes a
[GitHub Release](https://github.com/TonTuyau/LaPompe/releases) with the Chrome and Firefox zips and the source package
(`.github/workflows/release.yml`), then, once you approve it, submits the version to addons.mozilla.org and the
Chrome Web Store for their review ([docs/STORES.md](docs/STORES.md): how, and the credentials to set up once). What the
add-on stores ask for is in [docs/store](docs/store/README.md); [docs/BUILD.md](docs/BUILD.md) says how to rebuild it
from the source.

## Development

Node 24 and pnpm (`corepack enable`), then:

```bash
pnpm install
pnpm run build
```

`dist/chrome` and `dist/firefox` are the extension, ready to load unpacked; `dist/lapompe-<version>-<browser>.zip`
are the same, to publish:

- **Firefox**: `about:debugging` → This Firefox → Load Temporary Add-on → `dist/firefox/manifest.json`.
- **Chrome**: `chrome://extensions` → Developer mode → Load unpacked → `dist/chrome`.

`scripts/check.sh` lints, type-checks, tests and builds, as CI does on each pull request.

|                       |                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `scripts/manifest.ts` | the manifest (MV3), one per browser: Chrome's background is a service worker, Firefox's a script |
| `scripts/build.ts`    | the pages (Svelte, Vite), the background and content script (one file each), the icons, the zips |
| `public/_locales`     | its words, English and French, as the browser                                                    |
