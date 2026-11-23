<script lang="ts">
  /**
   * Panneau latéral partagé (couleurs, fiche d'identité) : en-tête, fermeture, corps
   * défilant et pied facultatif. Modal, il prend le focus et le rend à la fermeture ;
   * sinon il accompagne la vue sans la bloquer.
   */
  import { onMount, type Snippet } from 'svelte';

  interface Props {
    id: string;
    eyebrow: string;
    title: string;
    closeLabel: string;
    modal?: boolean;
    /** « side » : centré à droite ; « stage » : sous les outils de la vue 3D. */
    placement?: 'side' | 'stage';
    onclose: () => void;
    children: Snippet;
    /** Stays in place above the scrolling body (tabs, for instance). */
    toolbar?: Snippet;
    footer?: Snippet;
  }
  let {
    id,
    eyebrow,
    title,
    closeLabel,
    modal = false,
    placement = 'side',
    onclose,
    children,
    toolbar,
    footer,
  }: Props = $props();
  let dialog: HTMLDialogElement;
  let heading: HTMLHeadingElement;

  onMount(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    if (modal) {
      dialog.showModal();
      heading.focus();
    } else {
      dialog.show();
      // show() déplace le focus dans le panneau : la vue 3D le garde, avec ses raccourcis
      // (Espace pour refermer l'aperçu, flèches pour tourner la montre).
      if (previousFocus?.isConnected && previousFocus !== document.body)
        previousFocus.focus({ preventScroll: true });
    }
    return () => {
      dialog.close();
      if (modal && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  });

  function backdrop(event: MouseEvent) {
    if (!modal || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      onclose();
  }
</script>

<dialog
  bind:this={dialog}
  class="sheet {placement}"
  aria-labelledby={id}
  oncancel={(event) => {
    event.preventDefault();
    onclose();
  }}
  onkeydown={(event) => {
    // Modal, the panel owns the keyboard; otherwise the 3D view keeps its shortcuts.
    if (modal) event.stopPropagation();
  }}
  onclick={backdrop}
>
  <div class="frame">
    <header>
      <div>
        <p class="eyebrow">{eyebrow}</p>
        <h2 {id} tabindex="-1" bind:this={heading}>{title}</h2>
      </div>
      <button type="button" class="close" aria-label={closeLabel} onclick={onclose}>×</button>
    </header>
    {#if toolbar}<div class="toolbar">{@render toolbar()}</div>{/if}
    <div class="body">{@render children()}</div>
    {#if footer}<footer>{@render footer()}</footer>{/if}
  </div>
</dialog>

<style>
  /* Explicit tones rather than light-dark(): the production CSS transpiler turns that
     function into variables that only a static color-scheme rule would define, and the
     tone here is set at runtime from the dial colour. */
  dialog {
    --ink: #20242b;
    --veil: #faf9f6;
    /* Outlined controls need a filled surface to read as buttons on the pale veil. */
    --control: color-mix(in srgb, var(--ink) 5%, transparent);
    --control-line: color-mix(in srgb, var(--ink) 28%, transparent);
    --sheet-top: 50%;
    --sheet-max: calc(100dvh - 48px);
    position: fixed;
    inset: var(--sheet-top) calc(24px + env(safe-area-inset-right)) auto auto;
    translate: 0 -50%;
    margin: 0;
    width: 340px;
    max-width: calc(100vw - 32px);
    max-height: var(--sheet-max);
    padding: 24px;
    box-sizing: border-box;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
    border-radius: 22px;
    background: var(--veil);
    color: var(--ink);
    box-shadow: 0 16px 80px #0003;
    font: inherit;
  }
  :global(:root[data-tone='dark']) dialog {
    --ink: #f4f3ef;
    --veil: #25282c;
  }
  dialog.stage {
    --sheet-top: calc(var(--chrome-top, 84px) + 60px);
    --sheet-max: calc(100dvh - var(--sheet-top) - 72px - env(safe-area-inset-bottom));
    z-index: 3;
    translate: none;
    animation: sheet-in 220ms cubic-bezier(0.2, 0, 0, 1);
  }
  @keyframes sheet-in {
    from {
      opacity: 0;
      transform: translateX(16px);
    }
  }
  dialog::backdrop {
    background: #0001;
  }
  .frame {
    display: flex;
    flex-direction: column;
    max-height: calc(var(--sheet-max) - 50px);
  }
  header,
  .toolbar,
  footer {
    flex-shrink: 0;
  }
  .toolbar {
    margin: 0 0 18px;
  }
  .body {
    min-height: 0;
    overflow-y: auto;
    padding: 4px;
    margin: -4px;
    scrollbar-width: thin;
  }
  header {
    margin-bottom: 20px;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    align-items: center;
  }
  .eyebrow {
    font-size: 9px;
    letter-spacing: 0.16em;
    opacity: 0.5;
    margin: 0;
  }
  h2 {
    font-size: 19px;
    line-height: 1.2;
    font-weight: 500;
    margin: 0;
    outline: none;
  }
  .close {
    background: transparent;
    border: 0;
    font-size: 26px;
    font-weight: 300;
    padding: 2px;
    min-width: 36px;
    min-height: 40px;
    line-height: 1;
  }
  footer {
    display: flex;
    margin-top: 24px;
  }

  /* Shared vocabulary for the content of every sheet. */
  .sheet :global(button),
  .sheet :global(input) {
    font: inherit;
    color: inherit;
  }
  .sheet :global(button) {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .sheet :global(button:focus-visible),
  .sheet :global(input:focus-visible) {
    outline: 2px solid var(--ink);
    outline-offset: 3px;
  }
  .sheet :global(.section-label) {
    font-size: 11px;
    opacity: 0.65;
    margin: 0 0 8px;
  }
  .sheet :global(.dot) {
    flex-shrink: 0;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--swatch);
    box-shadow: inset 0 0 0 1px #8885;
  }
  .sheet :global(.dot.metal) {
    background: linear-gradient(135deg, #fff9, transparent 45%, #0004), var(--swatch);
  }

  @media (max-width: 759px) {
    dialog,
    dialog.stage {
      --sheet-max: 66dvh;
      inset: auto 0 0;
      translate: none;
      width: 100%;
      max-width: 100%;
      border-radius: 22px 22px 0 0;
      padding: 20px 24px calc(20px + env(safe-area-inset-bottom));
    }
    dialog.stage {
      --sheet-max: 52dvh;
    }
    .frame {
      max-height: calc(var(--sheet-max) - 42px - env(safe-area-inset-bottom));
    }
    header {
      margin-bottom: 14px;
    }
    footer {
      margin-top: 16px;
    }
  }
</style>
