// LaPompe on YouTube's pages: see lib/content.ts.
import { startContent } from './lib/content'
import { ext } from './lib/ext'

// Firefox gives a content script the page's own fetch as content.fetch (cookies and all); Chrome's fetch already is.
// Not just `content`: on YouTube, Chrome answers window.content with the page's <div id="content">.
const page = (globalThis as { content?: { fetch?: unknown } }).content
const pageFetch =
  typeof page?.fetch === 'function' ? (page.fetch as typeof fetch).bind(page) : window.fetch.bind(window)

startContent(window, ext, pageFetch)
