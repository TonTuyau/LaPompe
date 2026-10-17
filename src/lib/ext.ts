// The WebExtension API: Firefox's `browser`, else Chrome's `chrome`; both answer with promises in MV3. Looked up at
// each use, so tests can put a fake one in place (globalThis.chrome).
type Api = typeof chrome

function current(): Api {
  return (globalThis as { browser?: Api }).browser ?? globalThis.chrome
}

export const ext: Api = new Proxy({} as Api, {
  get: (_target, property) => current()[property as keyof Api],
})
