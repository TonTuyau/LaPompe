<script lang="ts">
  // The settings page: the TonTuyau LaPompe sends to (0.3.0: several, a card each: a name of its own, its address, its
  // browser-extension API key; Test the connection, Remove), and how often the cookie is sent, to all of them. Save and
  // Test first ask the browser for leave to reach those addresses and youtube.com: asked at once in the click (Firefox
  // only asks in answer to one), before anything else waits. Save gives back the leave of an address no longer listed.
  import Logo from '../components/Logo.svelte'
  import { ext } from '../lib/ext'
  import { t } from '../lib/i18n'
  import { forgetOthers, learnedFrom, loadKnown, remember, type KnownTonTuyau } from '../lib/pump'
  import {
    checkInstance,
    checkSettings,
    defaultSettings,
    hasProblems,
    label,
    loadSettings,
    minMinutes,
    newInstanceId,
    originPattern,
    saveSettings,
    type Instance,
    type InstanceProblems,
    type SettingsProblems,
  } from '../lib/settings'
  import { connect, TonTuyauError } from '../lib/tontuyau'

  let instances = $state<Instance[]>([])
  let everyMinutes = $state<number | null>(defaultSettings.everyMinutes)
  let known = $state<Record<string, KnownTonTuyau>>({})
  let problems = $state<SettingsProblems>({})
  let results = $state<Record<string, { text: string; ok: boolean }>>({})
  let result = $state<{ text: string; ok: boolean } | null>(null)
  let busy = $state(false)
  let testing = $state<string | null>(null)
  /** The settings as saved: which instances keep what LaPompe knows of them, which addresses to give back. */
  let saved: Instance[] = []
  /** An address tested on this page, by instance id: what its test taught is kept once saved. */
  const tested: Record<string, string> = {}

  const blank = (): Instance => ({ id: newInstanceId(), name: '', url: '', apiKey: '' })

  $effect(() => {
    void Promise.all([loadSettings(ext.storage.local), loadKnown(ext.storage.local)]).then(([stored, knownNow]) => {
      saved = stored.instances
      instances = stored.instances.length > 0 ? stored.instances.map((instance) => ({ ...instance })) : [blank()]
      everyMinutes = stored.everyMinutes
      known = knownNow
    })
  })

  const youTube = '*://*.youtube.com/*'

  function add() {
    instances.push(blank())
    result = null
  }

  function remove(id: string) {
    instances = instances.filter((instance) => instance.id !== id)
    result = null
  }

  async function save(event: SubmitEvent) {
    event.preventDefault()
    const checked = checkSettings({ instances, everyMinutes: everyMinutes ?? Number.NaN })
    problems = checked.problems
    result = null
    if (hasProblems(checked.problems)) {
      return
    }
    const origins = [...new Set(checked.settings.instances.map((instance) => originPattern(instance.url)))]
    const granted = ext.permissions.request({ origins: [...origins, youTube] })
    busy = true
    try {
      if (!(await granted)) {
        result = { text: t('permissionRefusedAll'), ok: false }
        return
      }
      await saveSettings(ext.storage.local, checked.settings)
      // What LaPompe knows of a TonTuyau is kept while its address stays (or was just tested at that address).
      const kept = checked.settings.instances.filter(
        (instance) =>
          saved.some((before) => before.id === instance.id && before.url === instance.url) ||
          tested[instance.id] === instance.url,
      )
      await forgetOthers(ext.storage.local, kept)
      const unused = saved.map((instance) => originPattern(instance.url)).filter((origin) => !origins.includes(origin))
      if (unused.length > 0) await ext.permissions.remove({ origins: unused })
      saved = checked.settings.instances
      instances = checked.settings.instances.map((instance) => ({ ...instance }))
      known = await loadKnown(ext.storage.local)
      result = { text: t('saved'), ok: true }
    } finally {
      busy = false
    }
  }

  async function test(typed: Instance) {
    const checked = checkInstance(typed)
    problems = { ...problems, instances: { ...problems.instances, [typed.id]: checked.problems } }
    results = Object.fromEntries(Object.entries(results).filter(([id]) => id !== typed.id))
    if (Object.keys(checked.problems).length > 0) {
      return
    }
    const granted = ext.permissions.request({ origins: [originPattern(checked.instance.url), youTube] })
    busy = true
    testing = typed.id
    try {
      if (!(await granted)) {
        results[typed.id] = { text: t('permissionRefused', checked.instance.url), ok: false }
        return
      }
      const connection = await connect(checked.instance)
      await remember(ext.storage.local, typed.id, learnedFrom(connection))
      tested[typed.id] = checked.instance.url
      known = await loadKnown(ext.storage.local)
      results[typed.id] = { text: t('connected', connection.version, connection.name), ok: true }
    } catch (error) {
      if (!(error instanceof TonTuyauError)) throw error
      results[typed.id] = { text: failure(error), ok: false }
    } finally {
      busy = false
      testing = null
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
    'url:twice': 'urlTwice',
    'apiKey:missing': 'keyMissing',
    'apiKey:notAKey': 'keyNotAKey',
  }
  const problemText = (id: string, field: keyof InstanceProblems): string | null => {
    const kind = problems.instances?.[id]?.[field]
    return kind ? t(words[`${field}:${kind}`] ?? kind) : null
  }
  const hostOf = (url: string): string => {
    try {
      return new URL(url).host
    } catch {
      return ''
    }
  }
</script>

<main>
  <header>
    <Logo size={32} />
    <h1>{t('optionsTitle')}</h1>
  </header>

  <form onsubmit={save} novalidate>
    <section class="instances" aria-labelledby="instances-title">
      <div class="title">
        <h2 id="instances-title">{t('instancesTitle')}</h2>
        <small>{instances.length === 1 ? t('instancesOne') : t('instancesMany', instances.length)}</small>
      </div>

      {#each instances as instance, index (instance.id)}
        {@const shown = results[instance.id]}
        {@const version = known[instance.id]?.version}
        <fieldset class="card">
          <legend>
            <span class="number" aria-hidden="true">{index + 1}</span>
            {instance.url.trim() !== '' || instance.name.trim() !== '' ? label(instance) : t('newInstance')}
            {#if version}<small>· {t('versionShort', version)}</small>{/if}
          </legend>

          <div class="grid">
            <div class="field">
              <label for="name-{instance.id}">{t('nameLabel')} <small>{t('optional')}</small></label>
              <input
                id="name-{instance.id}"
                bind:value={instance.name}
                placeholder={hostOf(instance.url) || t('namePlaceholder')}
                autocomplete="off"
              />
            </div>
            <div class="field">
              <label for="url-{instance.id}">{t('urlLabel')}</label>
              <input
                id="url-{instance.id}"
                type="url"
                bind:value={instance.url}
                placeholder="https://tontuyau.example.net"
                autocomplete="off"
                aria-invalid={problemText(instance.id, 'url') !== null}
              />
              {#if problemText(instance.id, 'url')}
                <small class="invalid" role="alert">{problemText(instance.id, 'url')}</small>
              {/if}
            </div>
          </div>

          <div class="field">
            <label for="key-{instance.id}">{t('keyLabel')}</label>
            <input
              id="key-{instance.id}"
              class="mono"
              type="password"
              bind:value={instance.apiKey}
              placeholder="tt_…"
              autocomplete="off"
              spellcheck="false"
              aria-invalid={problemText(instance.id, 'apiKey') !== null}
              aria-describedby="key-hint-{instance.id}"
            />
            {#if problemText(instance.id, 'apiKey')}
              <small class="invalid" role="alert">{problemText(instance.id, 'apiKey')}</small>
            {/if}
            <small id="key-hint-{instance.id}">{t('keyHint')}</small>
          </div>

          <div class="actions">
            <button class="button tonal" type="button" disabled={busy} onclick={() => test(instance)}>
              {testing === instance.id ? t('testing') : t('test')}
            </button>
            {#if instances.length > 1}
              <button class="button tonal danger" type="button" disabled={busy} onclick={() => remove(instance.id)}>
                {t('remove')}
              </button>
            {/if}
            {#if shown}
              <span class="result" class:ok={shown.ok} class:error={!shown.ok} role="status">{shown.text}</span>
            {/if}
          </div>
        </fieldset>
      {/each}

      <button class="button tonal add" type="button" onclick={add}>
        <span aria-hidden="true">＋</span>
        {t('addInstance')}
      </button>

      <p class="alert warn"><b>{t('cookieToEvery')}</b> {t('cookieToEveryHint')}</p>
    </section>

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
      {#if problems.everyMinutes}<small class="invalid" role="alert">{t('everyTooShort', minMinutes)}</small>{/if}
      <small id="every-hint">{t('everyHint', minMinutes)}</small>
    </div>

    <div class="actions">
      <button class="button" type="submit" disabled={busy}>{t('save')}</button>
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
    max-width: 680px;
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

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  .instances {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .title {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
    margin: 0;
    padding: 14px 16px 16px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: color-mix(in srgb, var(--surface) 35%, transparent);
  }

  legend {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 6px;
    font-weight: 500;
  }

  .number {
    display: inline-grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--brand);
    color: var(--on-button);
    font-size: 12px;
  }

  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
    gap: 12px;
  }

  @media (max-width: 520px) {
    .grid {
      grid-template-columns: 1fr;
    }
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
    font-weight: 400;
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

  .add {
    align-self: flex-start;
  }

  .danger {
    color: var(--error);
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
