<script lang="ts">
  // The toolbar button's popup: which TonTuyau and as whom, the cookie's state as TonTuyau last answered (or why it
  // didn't go through), when it's sent next, and "Send the cookie now" (the background sends it: one send at a
  // time). Not set up: a link to the settings.
  import Logo from '../components/Logo.svelte'
  import { alarmName, type PumpMessage } from '../lib/background'
  import { ext } from '../lib/ext'
  import { relative, t } from '../lib/i18n'
  import { loadKnownTonTuyau, loadLastSend, type KnownTonTuyau, type LastSend } from '../lib/pump'
  import { isSetUp, loadSettings, type Settings } from '../lib/settings'

  let settings = $state<Settings | null>(null)
  let known = $state<KnownTonTuyau>({ version: null, name: null, canAdd: null })
  let last = $state<LastSend | null>(null)
  let next = $state<Date | null>(null)
  let sending = $state(false)
  let now = $state(new Date())

  async function load() {
    settings = await loadSettings(ext.storage.local)
    known = await loadKnownTonTuyau(ext.storage.local)
    last = await loadLastSend(ext.storage.local)
    const alarm = await ext.alarms.get(alarmName)
    next = alarm ? new Date(alarm.scheduledTime) : null
    now = new Date()
  }

  $effect(() => {
    void load()
  })

  async function sendNow() {
    sending = true
    try {
      const message: PumpMessage = { type: 'pump' }
      last = (await ext.runtime.sendMessage(message)) as LastSend
    } finally {
      sending = false
      await load()
    }
  }

  const host = $derived(settings?.url ? new URL(settings.url).host : '')
  const stateKey = $derived(
    last?.cookie?.state === 'works'
      ? 'cookieWorks'
      : last?.cookie?.state === 'refused'
        ? 'cookieRefused'
        : 'cookieUnchecked',
  )

  /** Why the last send didn't go through, or what YouTube said: in a sentence; null when all is well. */
  function problem(sent: LastSend): { text: string; level: 'warn' | 'error' } | null {
    switch (sent.failure) {
      case undefined:
        break
      case 'notSetUp':
        return null
      case 'noCookie':
        return { text: t('failureNoCookie'), level: 'warn' }
      case 'unreachable':
        return { text: t('failureUnreachable', sent.detail ?? ''), level: 'error' }
      case 'keyRefused':
        return { text: t('failureKeyRefused'), level: 'error' }
      case 'keyNotAllowed':
        return { text: t('failureKeyNotAllowed'), level: 'error' }
      case 'refused':
        return { text: t('failureRefused', sent.detail ?? ''), level: 'error' }
      default:
        return { text: t('failureUnexpected', sent.detail ?? ''), level: 'error' }
    }
    if (sent.cookie?.state === 'refused') {
      return { text: t('cookieRefusedHint'), level: 'error' }
    }
    return sent.cookie?.state === 'unchecked' ? { text: t('cookieUncheckedHint'), level: 'warn' } : null
  }

  const shown = $derived(last ? problem(last) : null)
</script>

<div class="popup">
  <header>
    <Logo />
    <div class="name">
      <b>{t('name')}</b>
      <small>{t('tagline')}</small>
    </div>
    {#if settings && isSetUp(settings)}
      <button class="gear" type="button" title={t('settings')} onclick={() => ext.runtime.openOptionsPage()}>
        <svg viewBox="0 0 24 24" aria-hidden="true"
          ><path
            d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.8a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.8a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5L19.4 13zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
          /></svg
        >
        <span class="visually-hidden">{t('settings')}</span>
      </button>
    {/if}
  </header>

  {#if settings && !isSetUp(settings)}
    <div class="body">
      <p class="alert warn">{t('notSetUp')}</p>
      <button class="button full" type="button" onclick={() => ext.runtime.openOptionsPage()}>
        {t('openSettings')}
      </button>
    </div>
  {:else if settings}
    <div class="body">
      <dl>
        <dt>{t('popupTonTuyau')}</dt>
        <dd>
          <a href={settings.url} target="_blank" rel="noreferrer">{host}</a>{known.version ? ` · ${known.version}` : ''}
        </dd>
        {#if known.name}
          <dt>{t('popupAs')}</dt>
          <dd>{known.name}</dd>
        {/if}
        <dt>{t('popupCookie')}</dt>
        <dd>
          {#if last?.cookie}
            <span class="pill {last.cookie.state}">{t(stateKey)}</span>
          {/if}
          {last ? t('sentAgo', relative(new Date(last.at), now)) : t('neverSent')}
        </dd>
        {#if next}
          <dt>{t('popupNext')}</dt>
          <dd>{t('nextIn', relative(next, now), settings.everyMinutes)}</dd>
        {/if}
      </dl>
      {#if shown}
        <p class="alert {shown.level}" role="alert">{shown.text}</p>
      {/if}
      <button class="button full" type="button" disabled={sending} onclick={sendNow}>
        {sending ? t('sending') : t('sendNow')}
      </button>
      <p class="hint">{t('sendHint')}</p>
    </div>
  {/if}

  <footer>
    <span>{t('footVersion', ext.runtime.getManifest().version)}</span>
    {#if settings && isSetUp(settings)}
      <button class="link" type="button" onclick={() => ext.runtime.openOptionsPage()}>{t('settings')}</button>
    {/if}
  </footer>
</div>

<style>
  .popup {
    width: 340px;
  }

  header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--divider);
  }

  .name {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  .name b {
    font-size: 16px;
    font-weight: 700;
  }

  .name small {
    color: var(--text-2);
    font-size: 12px;
  }

  .gear {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    margin-left: auto;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--text-2);
    cursor: pointer;
  }

  .gear:hover {
    background: var(--surface);
  }

  .gear svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 14px 14px;
  }

  dl {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 6px 12px;
    margin: 0;
    font-size: 13px;
  }

  dt {
    color: var(--text-2);
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    border-radius: 6px;
    background: var(--surface);
    color: var(--text-2);
    font-size: 12px;
    font-weight: 500;
  }

  .pill.works {
    background: var(--ok-bg);
    color: var(--ok);
  }

  .pill.refused {
    background: var(--error-bg);
    color: var(--error);
  }

  .full {
    width: 100%;
  }

  footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-top: 1px solid var(--divider);
    color: var(--text-2);
    font-size: 12px;
  }

  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--link);
    font: inherit;
    cursor: pointer;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
