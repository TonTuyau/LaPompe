// LaPompe's manifest (MV3), one per browser: Chrome runs its background as a service worker, Firefox as a script
// (event page), with its own id. The rest is the same: the popup, the settings page, the YouTube cookie (the cookies
// permission and youtube.com), the alarm that sends it, and the content script on YouTube's pages. TonTuyau's own
// address isn't known in advance: the settings page asks for it (optional_host_permissions) when it's saved.

export type Browser = 'chrome' | 'firefox'

export const browsers: Browser[] = ['chrome', 'firefox']

/** The icon's sizes, as PNG (Chrome takes no SVG). */
export const iconSizes = [16, 32, 48, 128] as const

/** Firefox's id for LaPompe: never changes once published (the add-on's identity there). */
export const firefoxId = 'lapompe@tontuyau'

export function manifest(browser: Browser, version: string): Record<string, unknown> {
  const icons = Object.fromEntries(iconSizes.map((size) => [String(size), `icons/lapompe-${size}.png`]))
  const common = {
    manifest_version: 3,
    name: '__MSG_name__',
    short_name: 'LaPompe',
    description: '__MSG_description__',
    default_locale: 'en',
    version,
    icons,
    action: { default_popup: 'popup.html', default_title: '__MSG_name__', default_icon: icons },
    options_ui: { page: 'options.html', open_in_tab: true },
    permissions: ['cookies', 'storage', 'alarms'],
    host_permissions: ['*://*.youtube.com/*'],
    optional_host_permissions: ['https://*/*', 'http://*/*'],
    content_scripts: [{ matches: ['https://www.youtube.com/*'], js: ['content.js'], run_at: 'document_idle' }],
  }
  return browser === 'chrome'
    ? { ...common, background: { service_worker: 'background.js' }, minimum_chrome_version: '120' }
    : {
        ...common,
        // A dark toolbar gets the light pump (Chrome has no such choice: the dark one everywhere).
        action: {
          ...common.action,
          theme_icons: iconSizes.map((size) => ({
            light: `icons/lapompe-light-${size}.png`,
            dark: `icons/lapompe-${size}.png`,
            size,
          })),
        },
        background: { scripts: ['background.js'] },
        browser_specific_settings: {
          gecko: {
            id: firefoxId,
            // The first versions that know data_collection_permissions: 140 (an ESR) and, on Android, 142.
            strict_min_version: '140.0',
            // It sends the browser's YouTube cookie (a sign-in) to the TonTuyau its user chose, nowhere else.
            data_collection_permissions: { required: ['authenticationInfo'] },
          },
          gecko_android: { strict_min_version: '142.0' },
        },
      }
}
