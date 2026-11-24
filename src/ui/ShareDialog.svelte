<script lang="ts">
  /**
   * Partage, en panneau à côté de la montre 3D (comme la fiche d'identité) : réseaux, lien,
   * prompt de génération pour une IA et capture de la vue telle qu'elle est affichée.
   */
  import { onDestroy, onMount } from 'svelte';
  import Button from './kit/Button.svelte';
  import Sheet from './sheet/Sheet.svelte';
  import { t } from './i18n.svelte';

  interface Props {
    url: string;
    prompt: string;
    /** PNG of the 3D watch as currently shown; null until the 3D view is mounted. */
    capture: (() => Promise<Blob>) | null;
    onclose: () => void;
  }
  let { url, prompt, capture, onclose }: Props = $props();

  const TITLE = $derived(t().share.shareTitle);
  const TEXT = $derived(t().share.shareText);

  let linkInput = $state<HTMLInputElement>();
  let copyState = $state<'idle' | 'copied' | 'manual'>('idle');
  let promptState = $state<'idle' | 'copied' | 'failed'>('idle');
  let captureState = $state<'idle' | 'busy' | 'saved' | 'failed'>('idle');
  const nativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  let resetTimer: ReturnType<typeof setTimeout> | undefined;
  let promptTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => {
    clearTimeout(resetTimer);
    clearTimeout(promptTimer);
  });

  // The panel opens on the link, selected, as the modal did.
  onMount(() => {
    linkInput?.focus({ preventScroll: true });
    linkInput?.select();
  });

  const enc = encodeURIComponent;
  const networks = $derived([
    {
      name: 'WhatsApp',
      href: `https://wa.me/?text=${enc(`${TEXT} ${url}`)}`,
      icon: 'M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.25-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.42.25-.69.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.9a11.82 11.82 0 0 0-3.48-8.41Z',
    },
    {
      name: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
      icon: 'M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07Z',
    },
    {
      name: 'X',
      href: `https://x.com/intent/tweet?text=${enc(TEXT)}&url=${enc(url)}`,
      icon: 'M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.6l5.24 6.93 6.06-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41Z',
    },
    {
      name: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
      icon: 'M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12Zm1.78 13.02H3.56V9h3.56v11.45ZM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0h.01Z',
    },
    {
      name: 'Telegram',
      href: `https://t.me/share/url?url=${enc(url)}&text=${enc(TEXT)}`,
      icon: 'M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm4.96 7.22c.1 0 .32.02.47.14.1.08.16.2.17.33.02.09.04.3.02.47-.18 1.9-.96 6.5-1.36 8.63-.17.9-.5 1.2-.82 1.23-.7.06-1.23-.46-1.9-.9-1.06-.7-1.65-1.13-2.68-1.8-1.19-.79-.42-1.22.26-1.92.17-.18 3.25-2.98 3.3-3.23.01-.03.02-.15-.05-.21-.07-.06-.18-.04-.25-.02-.1.02-1.8 1.14-5.06 3.34-.48.33-.91.5-1.3.48-.43-.01-1.25-.24-1.87-.44-.75-.24-1.35-.37-1.3-.79.03-.21.33-.44.9-.66 3.5-1.52 5.83-2.53 7-3.01 3.33-1.39 4.02-1.63 4.47-1.64Z',
    },
  ]);
  const mailto = $derived(`mailto:?subject=${enc(TITLE)}&body=${enc(`${TEXT}\n\n${url}`)}`);

  async function copy() {
    clearTimeout(resetTimer);
    try {
      await navigator.clipboard.writeText(url);
      copyState = 'copied';
      resetTimer = setTimeout(() => (copyState = 'idle'), 2500);
    } catch {
      copyState = 'manual';
      linkInput?.focus();
      linkInput?.select();
    }
  }

  async function copyPrompt() {
    clearTimeout(promptTimer);
    try {
      await navigator.clipboard.writeText(prompt);
      promptState = 'copied';
      promptTimer = setTimeout(() => (promptState = 'idle'), 2500);
    } catch {
      promptState = 'failed';
    }
  }

  async function takeCapture() {
    if (!capture || captureState === 'busy') return;
    captureState = 'busy';
    try {
      const blob = await capture();
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = t().share.captureFile;
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      captureState = 'saved';
    } catch {
      captureState = 'failed';
    }
  }

  async function shareNative() {
    try {
      await navigator.share({ title: TITLE, text: TEXT, url });
      onclose();
    } catch {
      // Une annulation de la feuille native laisse simplement le panneau ouvert.
    }
  }
</script>

<Sheet
  id="share-title"
  eyebrow={t().share.eyebrow}
  title={t().share.title}
  closeLabel={t().share.close}
  placement="stage"
  {onclose}
>
  <div class="share">
    <ul class="networks">
      {#each networks as network (network.name)}
        <li>
          <a
            href={network.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t().share.on(network.name)}
          >
            <span class="disc">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={network.icon} /></svg>
            </span>
            <span class="label">{network.name}</span>
          </a>
        </li>
      {/each}
      <li>
        <a href={mailto} aria-label={t().share.byEmail}>
          <span class="disc">
            <svg viewBox="0 0 24 24" class="stroke" aria-hidden="true">
              <rect x="3" y="5.5" width="18" height="13" rx="2" />
              <path d="m3.5 7 8.5 6.5L20.5 7" />
            </svg>
          </span>
          <span class="label">{t().share.email}</span>
        </a>
      </li>
    </ul>

    <label for="configuration-link">{t().share.link}</label>
    <div class="link-row">
      <input
        id="configuration-link"
        bind:this={linkInput}
        value={url}
        readonly
        onclick={() => linkInput?.select()}
      />
      <Button variant="primary" onclick={copy}>
        {copyState === 'copied' ? t().share.copied : t().share.copy}
      </Button>
    </div>
    <p class="status" role="status">
      {#if copyState === 'copied'}
        {t().share.copiedStatus}
      {:else if copyState === 'manual'}
        {t().share.manual}
      {/if}
    </p>

    <section class="prompt" aria-labelledby="generation-prompt">
      <h3 id="generation-prompt">{t().share.prompt}</h3>
      <p>{t().share.promptHint}</p>
      <div class="actions">
        <Button variant="primary" onclick={copyPrompt}>
          {promptState === 'copied' ? t().share.copied : t().share.copyPrompt}
        </Button>
        <Button disabled={!capture} aria-busy={captureState === 'busy'} onclick={takeCapture}>
          {captureState === 'busy' ? t().share.capturing : t().share.capture}
        </Button>
      </div>
      <p class="status" role="status">
        {#if promptState === 'copied'}
          {t().share.promptCopiedStatus}
        {:else if promptState === 'failed'}
          {t().share.promptManual}
        {:else if captureState === 'saved'}
          {t().share.captureStatus}
        {:else if captureState === 'failed'}
          {t().share.captureFailed}
        {/if}
      </p>
    </section>

    {#if nativeShare}
      <Button variant="quiet" class="more" onclick={shareNative}>
        <svg viewBox="0 0 24 24" class="stroke" aria-hidden="true">
          <path d="M12 15V3m-4 4 4-4 4 4M7 11H5v10h14V11h-2" />
        </svg>
        {t().share.more}
      </Button>
    {/if}
  </div>
</Sheet>

<style>
  .share .networks {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px 6px;
    margin: 0 0 22px;
    padding: 0;
    list-style: none;
  }
  .share .networks a {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    padding: 4px 0;
    border-radius: var(--radius-m);
    color: inherit;
    text-decoration: none;
  }
  .share .disc {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
    border-radius: 50%;
    transition:
      background 160ms,
      border-color 160ms,
      color 160ms;
  }
  .share .networks a:hover .disc {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--veil);
  }
  .share .networks a:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
  }
  .share svg {
    width: 19px;
    height: 19px;
    fill: currentColor;
  }
  .share svg.stroke {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .share .label {
    font-size: var(--text-xs);
    letter-spacing: 0.02em;
    opacity: 0.8;
  }
  .share label {
    display: block;
    margin-bottom: 8px;
    font-size: var(--text-s);
  }
  .share .link-row {
    display: flex;
    gap: 8px;
  }
  .share input {
    flex: 1;
    min-width: 0;
    padding: 11px 12px;
    border: 1px solid color-mix(in srgb, var(--ink) 20%, transparent);
    border-radius: var(--radius-s);
    background: transparent;
    color: inherit;
    font:
      12px ui-monospace,
      monospace;
  }
  .share input:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
  }
  .share .link-row :global(.button) {
    flex: none;
    min-width: 116px;
  }
  .share .status {
    min-height: 1em;
    margin: 10px 0 0;
    font-size: var(--text-s);
    line-height: 1.5;
    opacity: 0.75;
  }
  .share .status:empty {
    margin: 0;
    min-height: 0;
  }
  .share .prompt {
    margin-top: 22px;
    padding-top: 20px;
    border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
  }
  .share .prompt h3 {
    margin: 0 0 6px;
    font-size: var(--text-s);
    font-weight: inherit;
  }
  .share .prompt p:not(.status) {
    margin: 0 0 12px;
    font-size: var(--text-s);
    line-height: 1.5;
    opacity: 0.75;
  }
  .share .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .share .actions :global(.button) {
    min-width: 0;
    padding: 0 10px;
  }
  .share :global(.more) {
    margin-top: 16px;
    padding-inline: 8px;
    margin-inline-start: -8px;
  }
  .share :global(.more svg) {
    width: 16px;
    height: 16px;
  }
  @media (max-width: 480px) {
    .share input {
      font-size: 16px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .share .disc {
      transition: none;
    }
  }
</style>
