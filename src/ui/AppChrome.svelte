<script lang="ts">
  import { onDestroy, tick } from 'svelte';

  let {
    url,
    inspecting,
    colorEditing,
  }: { url: string; inspecting: boolean; colorEditing: boolean } = $props();
  let busy = $state(false);
  let message = $state('');
  let sharedUrl = $state('');
  let manualCopy = $state(false);
  let shareButton: HTMLButtonElement;
  let dialog: HTMLDialogElement;
  let linkInput: HTMLInputElement;
  let messageTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(messageTimer));

  function notify(text: string) {
    clearTimeout(messageTimer);
    message = text;
    messageTimer = setTimeout(() => {
      message = '';
    }, 3000);
  }
  function closeShare() {
    dialog.close();
    shareButton.focus({ preventScroll: true });
  }
  async function copyLink(value: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(value);
      notify('Lien de la configuration copié');
      return true;
    } catch {
      return false;
    }
  }
  async function share() {
    if (busy) return;
    busy = true;
    const currentUrl = url;
    try {
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: 'Épure · Ma montre',
            text: 'Une montre composée dans l’atelier Épure.',
            url: currentUrl,
          });
          return;
        } catch (error) {
          // Cancelling a native sheet must never copy or send anything afterwards.
          if (error instanceof DOMException && error.name === 'AbortError') return;
        }
      }
      if (await copyLink(currentUrl)) return;
      sharedUrl = currentUrl;
      manualCopy = false;
      // Restore the trigger before opening the native dialog, for reliable focus return.
      busy = false;
      await tick();
      dialog.showModal();
      linkInput.focus();
      linkInput.select();
    } finally {
      busy = false;
    }
  }
</script>

<header class="app-header">
  <div class="brand" aria-label="Épure, atelier horloger">
    <svg class="mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M29.9 10.1a14 14 0 1 0 0 19.8M13 12v16h12M13 12h12M13 20h9" />
    </svg>
    <span>ÉPURE</span>
  </div>
  <button
    class="share-button"
    bind:this={shareButton}
    onclick={share}
    disabled={busy}
    aria-label="Partager la configuration"
  >
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15V3m-4 4 4-4 4 4M7 11H5v10h14V11h-2" />
    </svg>
    <span>Partager</span>
  </button>
</header>

<div class="share-status" role="status" class:shown={message !== ''}>{message}</div>

{#if !colorEditing}
  <footer aria-label="Aide à la navigation">
    <div class="keyboard-hints">
      {#if inspecting}
        <span><kbd>← ↑ ↓ →</kbd> Tourner</span>
        <span><kbd>1–5</kbd> Vues</span>
        <span><kbd>P</kbd> Pause</span>
        <span><kbd>Échap</kbd> Retour</span>
      {:else}
        <span><kbd>↑ ↓</kbd> Pièces</span>
        <span><kbd>← →</kbd> Variantes</span>
        <span><kbd>Entrée</kbd> Vue 3D</span>
      {/if}
    </div>
    <div class="touch-hints">
      {inspecting
        ? 'Glisser pour tourner · Pincer pour zoomer'
        : 'Glisser pour explorer · Toucher la montre pour la voir en 3D'}
    </div>
  </footer>
{/if}

<dialog
  bind:this={dialog}
  aria-labelledby="share-title"
  onkeydown={(event) => event.stopPropagation()}
  oncancel={(event) => {
    event.preventDefault();
    closeShare();
  }}
>
  <div class="dialog-heading">
    <h2 id="share-title">Partager votre montre</h2>
    <button class="close" aria-label="Fermer le partage" onclick={closeShare}>×</button>
  </div>
  <p>Ce lien contient tous les choix de votre configuration.</p>
  <label for="configuration-link">Lien de la configuration</label>
  <input
    id="configuration-link"
    bind:this={linkInput}
    value={sharedUrl}
    readonly
    onclick={() => linkInput.select()}
  />
  {#if manualCopy}<p role="status">
      Le lien est sélectionné. Utilisez le menu Copier de votre appareil ou le raccourci clavier
      habituel.
    </p>{/if}
  <div class="dialog-actions">
    <button onclick={closeShare}>Fermer</button>
    <button
      class="copy"
      onclick={async () => {
        if (await copyLink(sharedUrl)) closeShare();
        else {
          manualCopy = true;
          linkInput.focus();
          linkInput.select();
        }
      }}
    >
      Copier le lien
    </button>
  </div>
</dialog>

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
  button:focus-visible,
  input:focus-visible {
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
  .share-status {
    position: fixed;
    top: var(--chrome-top);
    right: calc(var(--chrome-gutter) + env(safe-area-inset-right));
    z-index: 11;
    max-width: calc(100vw - 40px);
    padding: 10px 14px;
    border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
    border-radius: 12px;
    background: var(--veil);
    font-size: 12px;
    opacity: 0;
    translate: 0 -4px;
    transition:
      opacity 180ms,
      translate 180ms;
    pointer-events: none;
  }
  .share-status.shown {
    opacity: 1;
    translate: 0 0;
  }
  footer {
    position: fixed;
    inset: auto 0 calc(18px + env(safe-area-inset-bottom));
    z-index: 9;
    display: flex;
    justify-content: center;
    padding: 8px 20px;
    pointer-events: none;
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
  dialog {
    margin: auto;
    width: min(420px, calc(100vw - 40px));
    padding: 24px;
    border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
    border-radius: 20px;
    background: var(--veil);
    color: var(--ink);
    box-shadow: 0 20px 100px #0003;
  }
  dialog::backdrop {
    background: #0004;
    backdrop-filter: blur(8px);
  }
  .dialog-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
  }
  dialog p {
    margin: 16px 0 20px;
    font-size: 12px;
    line-height: 1.6;
    opacity: 0.75;
  }
  .close {
    border: 0;
    background: transparent;
    font-size: 26px;
    line-height: 1;
    min-width: 36px;
    min-height: 36px;
  }
  dialog label {
    display: block;
    margin-bottom: 8px;
    font-size: 11px;
  }
  dialog input {
    width: 100%;
    padding: 12px;
    border: 1px solid color-mix(in srgb, var(--ink) 20%, transparent);
    border-radius: 8px;
    background: transparent;
    color: inherit;
    font:
      12px ui-monospace,
      monospace;
  }
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 24px;
  }
  .dialog-actions button {
    padding: 10px 14px;
    min-height: 42px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    font-size: 12px;
  }
  .dialog-actions .copy {
    background: var(--ink);
    color: var(--veil);
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
    }
    dialog input {
      font-size: 16px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .share-button,
    .share-status {
      transition: none;
    }
  }
</style>
