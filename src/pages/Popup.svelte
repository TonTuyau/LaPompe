<script lang="ts">
  // The toolbar button's popup: each TonTuyau (0.3.0: a row each, its name, address and version, the cookie's state
  // there as it last answered, or why it didn't go through), when the cookie is sent next, and "Send the cookie now",
  // to all of them (the background sends it: one send at a time). Not set up: a link to the settings.
  import Logo from '../components/Logo.svelte'
  import { alarmName, type PumpMessage } from '../lib/background'
  import { ext } from '../lib/ext'
  import { relative, t } from '../lib/i18n'
  import { loadKnown, loadPumped, type KnownTonTuyau, type LastSend, type Pumped } from '../lib/pump'
  import { isSetUp, label, loadSettings, type Settings } from '../lib/settings'

  let settings = $state<Settings | null>(null)
  let known = $state<Record<string, KnownTonTuyau>>({})
  let last = $state<Pumped | null>(null)
  let next = $state<Date | null>(null)
  let sending = $state(false)
  let now = $state(new Date())

  async function load() {
    settings = await loadSettings(ext.storage.local)
    known = await loadKnown(ext.storage.local)
    last = await loadPumped(ext.storage.local)
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
      last = (await ext.runtime.sendMessage(message)) as Pumped
    } finally {
      sending = false
      await load()
    }
  }

  const several = $derived((settings?.instances.length ?? 0) > 1)

  /** The cookie's state at one TonTuyau, as a pill; null before it was sent there. */
  function pill(sent: LastSend | undefined): { text: string; kind: string } | null {
    if (!sent) return null
    if (sent.failure) return { text: t('cookieNotSent'), kind: 'refused' }
    switch (sent.cookie?.state) {
      case 'works':
        return { text: t('cookieWorks'), kind: 'works' }
      case 'refused':
        return { text: t('cookieRefused'), kind: 'refused' }
      default:
        return { text: t('cookieUnchecked'), kind: 'unchecked' }
    }
  }

  /** Why the send to a TonTuyau didn't go through, or what YouTube said there: in a sentence; null when all is well. */
  function problem(sent: LastSend): { text: string; level: 'warn' | 'error' } | null {
    switch (sent.failure) {
      case undefined:
        break
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

  const reached = $derived(
    settings ? settings.instances.filter((instance) => last?.sends[instance.id]?.cookie !== undefined).length : 0,
  )
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
      <ul class="instances">
        {#each settings.instances as instance (instance.id)}
          {@const sent = last?.sends[instance.id]}
          {@const shown = pill(sent)}
          {@const wrong = sent ? problem(sent) : null}
          {@const of = known[instance.id]}
          <li>
            <div class="row">
              <div class="who">
                <b>{label(instance)}</b>
                <small
                  ><a href={instance.url} target="_blank" rel="noreferrer">{new URL(instance.url).host}</a>{of?.version
                    ? ` · ${of.version}`
                    : ''}{of?.name ? ` · ${of.name}` : ''}</small
                >
              </div>
              {#if shown}<span class="pill {shown.kind}">{shown.text}</span>{/if}
            </div>
            {#if wrong}
              <p class="alert {wrong.level}" role="alert">{wrong.text}</p>
            {/if}
          </li>
        {/each}
      </ul>

      {#if last?.failure === 'noCookie'}
        <p class="alert warn" role="alert">{t('failureNoCookie')}</p>
      {/if}

      <dl>
        <dt>{t('popupSent')}</dt>
        <dd>
          {last ? relative(new Date(last.at), now) : t('neverSent')}{last && several && !last.failure
            ? `, ${t('sentToSome', reached, settings.instances.length)}`
            : ''}
        </dd>
        {#if next}
          <dt>{t('popupNext')}</dt>
          <dd>{t('nextIn', relative(next, now), settings.everyMinutes)}</dd>
        {/if}
      </dl>
      <button class="button full" type="button" disabled={sending} onclick={sendNow}>
        {sending ? t('sending') : several ? t('sendNowAll') : t('sendNow')}
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

  .instances {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  li + li {
    padding-top: 10px;
    border-top: 1px solid var(--divider);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .who {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.3;
  }

  .who small {
    overflow: hidden;
    color: var(--text-2);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    flex: none;
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
