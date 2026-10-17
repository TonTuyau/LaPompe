# Building LaPompe from its source

For the add-on stores' reviewers, and anyone who wants to check that a published LaPompe is built from this source.
The published files are bundled by Vite: this rebuilds them, file for file.

## What's needed

- Linux, macOS or Windows (with WSL), with:
- **Node.js 24** (24.x; LaPompe is built with Node 24 in CI),
- **pnpm 12.8.1**, which Node's Corepack installs at the version `package.json` names: `corepack enable`.

## Steps

From the source package (`lapompe-<version>-source.zip`, attached to the release on
https://github.com/TonTuyau/LaPompe/releases), or a checkout of the tag `v<version>`:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run build
```

The result:

- `dist/firefox/`: the Firefox extension, the same files as `lapompe-<version>-firefox.zip`;
- `dist/chrome/`: the Chrome extension, the same files as `lapompe-<version>-chrome.zip`;
- the two zips themselves, in `dist/`.

`pnpm install --frozen-lockfile` installs exactly the versions in `pnpm-lock.yaml`. `scripts/build.ts` says how the
build goes: Vite bundles the popup and the settings page (Svelte) and, apart, the background and the content script,
one file each; the icons are drawn from `icons/*.svg`; `scripts/manifest.ts` writes each browser's manifest.

`scripts/check.sh` also lints, type-checks and runs the tests before building, as CI does.
