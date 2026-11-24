<script lang="ts">
  import AboutDialog from './AboutDialog.svelte';
  import ShareDialog from './ShareDialog.svelte';
  import { LOCALES } from '../core/i18n/locale';
  import { i18n, setLocale, t } from './i18n.svelte';

  let {
    url,
    inspecting,
    colorEditing,
    sheetShown = false,
  }: { url: string; inspecting: boolean; colorEditing: boolean; sheetShown?: boolean } = $props();
  let shareButton: HTMLButtonElement;
  let aboutButton = $state<HTMLButtonElement>();
  let shareDialog: ShareDialog;
  let aboutDialog: AboutDialog;
</script>

<header class="app-header">
  <div class="brand" aria-label={t().chrome.brand}>
    <svg class="mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M29.9 10.1a14 14 0 1 0 0 19.8M13 12v16h12M13 12h12M13 20h9" />
    </svg>
    <span>ÉPURE</span>
  </div>
  <button
    class="share-button"
    bind:this={shareButton}
    onclick={() => shareDialog.open(url)}
    aria-haspopup="dialog"
    aria-label={t().chrome.shareLabel}
  >
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15V3m-4 4 4-4 4 4M7 11H5v10h14V11h-2" />
    </svg>
    <span>{t().chrome.share}</span>
  </button>
</header>

{#if !colorEditing}
  <footer aria-label={t().chrome.footer} class:under-sheet={sheetShown}>
    <div class="keyboard-hints">
      {#if inspecting}
        <span><kbd>← ↑ ↓ →</kbd> {t().chrome.rotate}</span>
        <span><kbd>1–5</kbd> {t().chrome.views}</span>
        <span><kbd>P</kbd> {t().chrome.pause}</span>
        <span><kbd>I</kbd> {t().chrome.card}</span>
        <span><kbd>{t().chrome.escKey}</kbd> {t().chrome.back}</span>
      {:else}
        <span><kbd>↑ ↓</kbd> {t().chrome.parts}</span>
        <span><kbd>← →</kbd> {t().chrome.variants}</span>
        <span><kbd>{t().chrome.enterKey}</kbd> {t().chrome.view3d}</span>
      {/if}
    </div>
    <div class="touch-hints">
      {inspecting ? t().chrome.touchInspect : t().chrome.touchGrid}
    </div>
    <button
      class="about-button"
      bind:this={aboutButton}
      onclick={() => aboutDialog.open()}
      aria-haspopup="dialog"
    >
      {t().chrome.about}
    </button>
    <div class="language" role="group" aria-label={t().chrome.language}>
      {#each LOCALES as locale (locale)}
        <button
          type="button"
          lang={locale}
          aria-pressed={i18n.locale === locale}
          aria-label={locale === 'fr' ? 'Français' : 'English'}
          onclick={() => setLocale(locale)}
        >
          {locale.toUpperCase()}
        </button>
      {/each}
    </div>
  </footer>
{/if}

<ShareDialog bind:this={shareDialog} onclose={() => shareButton.focus({ preventScroll: true })} />
<AboutDialog bind:this={aboutDialog} onclose={() => aboutButton?.focus({ preventScroll: true })} />

<style>
  .app-header {
    position: fixed;
    inset: 0 0 auto;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(20px + env(safe-area-inset-top))
      calc(var(--chrome-gutter) + env(safe-area-inset-right)) 16px
      calc(var(--chrome-gutter) + env(safe-area-inset-left));
    background: linear-gradient(var(--veil) 72%, transparent);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 11px;
    opacity: 0.85;
    user-select: none;
  }
  .mark {
    width: 34px;
    height: 34px;
    stroke: currentColor;
    stroke-width: 1.45;
    stroke-linecap: square;
    stroke-linejoin: miter;
  }
  .brand span {
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.3em;
  }
  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  button:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 4px;
  }
  .share-button {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    min-height: 40px;
    border: 1px solid color-mix(in srgb, var(--ink) 20%, transparent);
    border-radius: 24px;
    padding: 9px 15px;
    background: color-mix(in srgb, var(--veil) 65%, transparent);
    font-size: 12px;
    letter-spacing: 0.02em;
    transition:
      background 180ms,
      border-color 180ms;
  }
  .share-button:hover {
    background: color-mix(in srgb, var(--ink) 8%, var(--veil));
    border-color: color-mix(in srgb, var(--ink) 40%, transparent);
  }
  .share-button:disabled {
    opacity: 0.5;
    cursor: progress;
  }
  .share-button svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  footer {
    position: fixed;
    inset: auto 0 calc(18px + env(safe-area-inset-bottom));
    z-index: 9;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 26px;
    padding: 8px 20px;
    pointer-events: none;
  }
  .about-button {
    flex: none;
    white-space: nowrap;
    pointer-events: auto;
    padding: 4px 2px;
    border: 0;
    background: transparent;
    font-size: 10px;
    color: color-mix(in srgb, var(--ink) 60%, var(--veil));
    text-decoration: underline;
    text-decoration-color: color-mix(in srgb, var(--ink) 25%, transparent);
    text-underline-offset: 3px;
    transition: color 160ms;
  }
  .about-button:hover {
    color: var(--ink);
  }
  /* Choix de la langue : deux sigles discrets, la langue active seule à pleine encre. */
  .language {
    display: flex;
    flex: none;
    align-items: center;
    pointer-events: auto;
  }
  .language button {
    padding: 4px 3px;
    border: 0;
    background: transparent;
    font-size: 9px;
    letter-spacing: 0.08em;
    color: color-mix(in srgb, var(--ink) 38%, var(--veil));
    transition: color 160ms;
  }
  .language button + button::before {
    content: '·';
    margin-right: 6px;
    color: color-mix(in srgb, var(--ink) 30%, var(--veil));
  }
  .language button:hover,
  .language button[aria-pressed='true'] {
    color: color-mix(in srgb, var(--ink) 75%, var(--veil));
  }
  .language button[aria-pressed='true'] {
    cursor: default;
  }
  .keyboard-hints {
    display: flex;
    align-items: center;
    gap: 26px;
    font-size: 10px;
    color: color-mix(in srgb, var(--ink) 60%, var(--veil));
  }
  .keyboard-hints > span {
    display: flex;
    align-items: center;
    gap: 7px;
    white-space: nowrap;
  }
  kbd {
    padding: 3px 5px;
    border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
    border-radius: 4px;
    font: inherit;
    font-size: 9px;
    letter-spacing: 0.02em;
  }
  .touch-hints {
    display: none;
    font-size: 10px;
    text-align: center;
    color: color-mix(in srgb, var(--ink) 60%, var(--veil));
  }
  @media (hover: none) and (pointer: coarse) {
    .keyboard-hints {
      display: none;
    }
    .touch-hints {
      display: block;
    }
  }
  @media (max-width: 600px) {
    .app-header {
      padding-top: calc(16px + env(safe-area-inset-top));
    }
    .brand {
      gap: 7px;
    }
    .brand span {
      font-size: 11px;
      letter-spacing: 0.24em;
    }
    .mark {
      width: 30px;
      height: 30px;
    }
    .share-button {
      min-height: 40px;
      padding: 9px 12px;
    }
    .keyboard-hints {
      gap: 12px;
      font-size: 9px;
    }
    .keyboard-hints > span {
      gap: 4px;
    }
    kbd {
      font-size: 8px;
      padding: 2px 3px;
    }
    footer {
      bottom: calc(10px + env(safe-area-inset-bottom));
      gap: 12px;
    }
    .about-button {
      font-size: 9px;
    }
    .language button {
      font-size: 8px;
    }
  }
  /* Below this width the identity card becomes a bottom sheet and covers the hints. */
  @media (max-width: 759px) {
    footer.under-sheet {
      display: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .share-button,
    .about-button,
    .language button {
      transition: none;
    }
  }
</style>
