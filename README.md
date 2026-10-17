# LaPompe

*LaPompe remplit TonTuyau.*

[TonTuyau](https://github.com/TonTuyau/TonTuyau)'s browser extension, for Firefox and Chrome: it sends your YouTube
cookie to TonTuyau, so TonTuyau reads YouTube signed in, and (with TonTuyau 1.6) adds "Add to TonTuyau" buttons to
YouTube's pages.

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

| | |
|---|---|
| `scripts/manifest.ts` | the manifest (MV3), one per browser: Chrome's background is a service worker, Firefox's a script |
| `scripts/build.ts` | the pages (Svelte, Vite), the background and content script (one file each), the icons, the zips |
| `public/_locales` | its words, English and French, as the browser |
