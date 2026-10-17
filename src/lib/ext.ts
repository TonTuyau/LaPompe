// The WebExtension API: Firefox's `browser`, else Chrome's `chrome`; both answer with promises in MV3.
export const ext: typeof chrome = (globalThis as { browser?: typeof chrome }).browser ?? globalThis.chrome
