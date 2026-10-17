import { firefoxId, manifest } from './manifest.ts'

describe('manifest', () => {
  it('runs the background as a service worker on Chrome, as a script with its own id on Firefox', () => {
    expect(manifest('chrome', '0.1.0').background).toEqual({ service_worker: 'background.js' })
    expect(manifest('chrome', '0.1.0')).not.toHaveProperty('browser_specific_settings')

    const firefox = manifest('firefox', '0.1.0')
    expect(firefox.background).toEqual({ scripts: ['background.js'] })
    expect(firefox.browser_specific_settings).toMatchObject({ gecko: { id: firefoxId } })
  })

  it("asks for the YouTube cookie and its alarm, never every site: TonTuyau's address is asked for later", () => {
    const chrome = manifest('chrome', '0.1.0')
    expect(chrome.manifest_version).toBe(3)
    expect(chrome.version).toBe('0.1.0')
    expect(chrome.permissions).toEqual(['cookies', 'storage', 'alarms'])
    expect(chrome.host_permissions).toEqual(['*://*.youtube.com/*'])
    expect(chrome.optional_host_permissions).toEqual(['https://*/*', 'http://*/*'])
  })

  it('names itself through the locales, and points at the popup and the settings page', () => {
    const chrome = manifest('chrome', '0.1.0')
    expect(chrome.name).toBe('__MSG_name__')
    expect(chrome.default_locale).toBe('en')
    expect(chrome.action).toMatchObject({ default_popup: 'popup.html' })
    expect(chrome.options_ui).toEqual({ page: 'options.html', open_in_tab: true })
  })
})
