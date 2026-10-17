// LaPompe's background (Chrome's service worker, Firefox's event page): see lib/background.ts.
import { startBackground } from './lib/background'
import { ext } from './lib/ext'

startBackground(ext)
