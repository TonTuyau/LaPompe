<script lang="ts">
  // The settings page: TonTuyau's address, the browser-extension API key, how often the cookie is sent. Save and Test
  // the connection first ask the browser for leave to reach that address and youtube.com: asked at once in the click
  // (Firefox only asks in answer to one), before anything else waits.
  import Logo from '../components/Logo.svelte'
  import { ext } from '../lib/ext'
  import { t } from '../lib/i18n'
  import { learnedFrom, remember } from '../lib/pump'
  import {
    checkSettings,
    defaultSettings,
    loadSettings,
    minMinutes,
    originPattern,
    saveSettings,
    type SettingsProblems,
  } from '../lib/settings'
  import { connect, TonTuyauError } from '../lib/tontuyau'

  let url = $state(defaultSettings.url)
  let apiKey = $state(defaultSettings.apiKey)
  let everyMinutes = $state<number | null>(defaultSettings.everyMinutes)
  let problems = $state<SettingsProblems>({})
  let result = $state<{ text: string; ok: boolean } | null>(null)
  let busy = $state(false)
  let testing = $state(false)

  $effect(() => {
    void loadSettings(ext.storage.local).then((stored) => {
      url = stored.url
      apiKey = stored.apiKey
      everyMinutes = stored.everyMinutes
    })
  })

  const youTube = '*://*.youtube.com/*'

  /** The settings as typed, checked; and, when they're fine, the browser asked for leave (its answer, later). */
  function checkAndAsk() {
    const checked = checkSettings({ url, apiKey, everyMinutes: everyMinutes ?? Number.NaN })
    problems = checked.problems
    result = null
    if (Object.keys(checked.problems).length > 0) {
      return null
    }
    const granted = ext.permissions.request({ origins: [originPattern(checked.settings.url), youTube] })
    return { settings: checked.settings, granted }
  }

  async function save(event: SubmitEvent) {
    event.preventDefault()
    const asked = checkAndAsk()
    if (!asked) return
    busy = true
    try {
      if (!(await asked.granted)) {
        result = { text: t('permissionRefused', asked.settings.url), ok: false }
        return
      }
      await saveSettings(ext.storage.local, asked.settings)
      url = asked.settings.url
      apiKey = asked.settings.apiKey
      result = { text: t('saved'), ok: true }
    } finally {
      busy = false
    }
  }

  async function test() {
    const asked = checkAndAsk()
    if (!asked) return
    busy = true
    testing = true
    try {
      if (!(await asked.granted)) {
        result = { text: t('permissionRefused', asked.settings.url), ok: false }
        return
      }
      const connection = await connect(asked.settings)
      await remember(ext.storage.local, learnedFrom(connection))
      result = { text: t('connected', connection.version, connection.name), ok: true }
    } catch (error) {
      if (!(error instanceof TonTuyauError)) throw error
      result = { text: failure(error), ok: false }
    } finally {
      busy = false
      testing = false
    }
  }

  function failure(error: TonTuyauError): string {
    switch (error.failure) {
      case 'unreachable':
        return t('failureUnreachable', error.detail)
      case 'keyRefused':
        return t('failureKeyRefused')
      case 'keyNotAllowed':
        return t('failureKeyNotAllowed')
      default:
        return t('failureUnexpected', error.detail)
    }
  }

  const words: Record<string, string> = {
    'url:missing': 'urlMissing',
    'url:notAnAddress': 'urlNotAnAddress',
    'apiKey:missing': 'keyMissing',
    'apiKey:notAKey': 'keyNotAKey',
    'everyMinutes:tooShort': 'everyTooShort',
  }
  const problemText = (field: keyof SettingsProblems): string | null => {
    const kind = problems[field]
    return kind ? t(words[`${field}:${kind}`] ?? kind, minMinutes) : null
  }
</script>

<main>
  <header>
    <Logo size={32} />
    <h1>{t('optionsTitle')}</h1>
  </header>

  <form onsubmit={save} novalidate>
    <div class="field">
      <label for="url">{t('urlLabel')}</label>
      <input
        id="url"
        type="url"
        bind:value={url}
        placeholder="https://tontuyau.example.net"
        autocomplete="off"
        aria-invalid={problems.url !== undefined}
        aria-describedby="url-hint"
      />
      {#if problemText('url')}<small class="invalid" role="alert">{problemText('url')}</small>{/if}
      <small id="url-hint">{t('urlHint')}</small>
    </div>

    <div class="field">
      <label for="key">{t('keyLabel')}</label>
      <input
        id="key"
        class="mono"
        type="password"
        bind:value={apiKey}
        placeholder="tt_…"
        autocomplete="off"
        spellcheck="false"
        aria-invalid={problems.apiKey !== undefined}
        aria-describedby="key-hint"
      />
      {#if problemText('apiKey')}<small class="invalid" role="alert">{problemText('apiKey')}</small>{/if}
      <small id="key-hint">{t('keyHint')}</small>
    </div>

    <div class="field">
      <label for="every">{t('everyLabel')}</label>
      <span class="inline">
        <input
          id="every"
          type="number"
          min={minMinutes}
          step="1"
          inputmode="numeric"
          bind:value={everyMinutes}
          aria-invalid={problems.everyMinutes !== undefined}
          aria-describedby="every-hint"
        />
        {t('minutes')}
      </span>
      {#if problemText('everyMinutes')}<small class="invalid" role="alert">{problemText('everyMinutes')}</small>{/if}
      <small id="every-hint">{t('everyHint', minMinutes)}</small>
    </div>

    <div class="actions">
      <button class="button" type="submit" disabled={busy}>{t('save')}</button>
      <button class="button tonal" type="button" disabled={busy} onclick={test}
        >{testing ? t('testing') : t('test')}</button
      >
      {#if result}
        <span class="result" class:ok={result.ok} class:error={!result.ok} role="status">{result.text}</span>
      {/if}
    </div>
  </form>

  <p class="hint note">{t('optionsNote')}</p>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 640px;
    margin: 0 auto;
    padding: 32px 16px;
  }

  header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 500;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 20px;
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  label {
    font-weight: 500;
  }

  small {
    color: var(--text-2);
    font-size: 12px;
  }

  input {
    height: 40px;
    max-width: 100%;
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--input);
    color: var(--text);
    font: inherit;
  }

  input[aria-invalid='true'] {
    border-color: var(--error);
  }

  .mono {
    font-family: 'Roboto Mono', ui-monospace, monospace;
    font-size: 13px;
  }

  .inline {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .inline input {
    width: 6rem;
  }

  .invalid {
    color: var(--error);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .result {
    font-size: 13px;
  }

  .result.ok {
    color: var(--ok);
  }

  .result.error {
    color: var(--error);
  }

  .note {
    max-width: 70ch;
  }
</style>
