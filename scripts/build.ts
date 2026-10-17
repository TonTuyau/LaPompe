// Builds LaPompe for each browser: dist/chrome and dist/firefox (load them unpacked), and a zip of each to publish.
//   1. the popup and the settings page (Svelte, Vite), with public/ (the locales) copied beside them;
//   2. the background and the content script, each one file (IIFE: neither can be an ES module everywhere);
//   3. the icon (and its light variant, for Firefox's dark toolbars), as PNG at each size;
//   4. per browser, everything above plus its own manifest.json, then its zip.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { zipSync } from 'fflate'
import { build } from 'vite'
import { browsers, iconSizes, manifest } from './manifest.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'dist')
const common = join(dist, 'common')
const version: string = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version

rmSync(dist, { recursive: true, force: true })

await build({ root, logLevel: 'warn', build: { outDir: common, emptyOutDir: true } })

for (const [entry, name] of [
  ['src/background.ts', 'LaPompeBackground'],
  ['src/content.ts', 'LaPompeContent'],
] as const) {
  await build({
    root,
    configFile: false,
    logLevel: 'warn',
    build: {
      outDir: common,
      emptyOutDir: false,
      lib: {
        entry: join(root, entry),
        formats: ['iife'],
        name,
        fileName: () => `${name === 'LaPompeBackground' ? 'background' : 'content'}.js`,
      },
    },
  })
}

mkdirSync(join(common, 'icons'), { recursive: true })
for (const icon of ['lapompe', 'lapompe-light']) {
  const svg = readFileSync(join(root, 'icons', `${icon}.svg`))
  for (const size of iconSizes) {
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()
    writeFileSync(join(common, 'icons', `${icon}-${size}.png`), png)
  }
}

for (const browser of browsers) {
  const out = join(dist, browser)
  cpSync(common, out, { recursive: true })
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest(browser, version), null, 2) + '\n')
  const files: Record<string, Uint8Array> = {}
  for (const file of walk(out)) {
    files[relative(out, file).replaceAll('\\', '/')] = readFileSync(file)
  }
  writeFileSync(join(dist, `lapompe-${version}-${browser}.zip`), zipSync(files, { level: 9 }))
}

rmSync(common, { recursive: true, force: true })
console.log(`LaPompe ${version}: ${browsers.map((b) => `dist/${b}, dist/lapompe-${version}-${b}.zip`).join('; ')}`)

function* walk(folder: string): Generator<string> {
  for (const name of readdirSync(folder).sort()) {
    const path = join(folder, name)
    if (statSync(path).isDirectory()) {
      yield* walk(path)
    } else {
      yield path
    }
  }
}
