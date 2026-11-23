<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    closeLabel,
    onclose,
    wide = false,
    children,
  }: {
    title: string;
    closeLabel: string;
    onclose?: () => void;
    wide?: boolean;
    children: Snippet;
  } = $props();
  const id = $props.id();
  let dialog: HTMLDialogElement;

  export function show() {
    dialog.showModal();
  }
  export function close() {
    if (dialog.open) dialog.close();
  }
</script>

<dialog
  bind:this={dialog}
  class:wide
  aria-labelledby="{id}-title"
  onkeydown={(event) => event.stopPropagation()}
  oncancel={(event) => {
    event.preventDefault();
    close();
  }}
  onclose={() => onclose?.()}
  onclick={(event) => {
    // Un clic sur le voile (hors du contenu) ferme la modale.
    if (event.target === dialog) close();
  }}
>
  <div class="body">
    <div class="heading">
      <h2 id="{id}-title">{title}</h2>
      <button class="close" aria-label={closeLabel} onclick={close}>×</button>
    </div>
    {@render children()}
  </div>
</dialog>

<style>
  dialog {
    margin: auto;
    width: min(440px, calc(100vw - 32px));
    max-height: calc(100dvh - 48px);
    padding: 0;
    border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
    border-radius: 20px;
    background: var(--veil);
    color: var(--ink);
    box-shadow: 0 20px 100px #0003;
    overscroll-behavior: contain;
  }
  dialog.wide {
    width: min(560px, calc(100vw - 32px));
  }
  dialog[open] {
    animation: rise 200ms ease-out;
  }
  dialog::backdrop {
    background: #0004;
    backdrop-filter: blur(8px);
  }
  .body {
    padding: 24px;
  }
  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 18px;
  }
  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
  }
  .close {
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 26px;
    line-height: 1;
    min-width: 36px;
    min-height: 36px;
    margin-right: -8px;
    cursor: pointer;
  }
  .close:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
    border-radius: 8px;
  }
  @keyframes rise {
    from {
      opacity: 0;
      translate: 0 8px;
    }
  }
  @media (max-width: 600px) {
    .body {
      padding: 20px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    dialog[open] {
      animation: none;
    }
  }
</style>
