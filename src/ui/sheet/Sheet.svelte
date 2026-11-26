<script lang="ts">
  /**
   * Le seul panneau de l'interface (couleurs, dimensions, fiche, partage, À propos) :
   * en-tête, fermeture, corps défilant et pied facultatif. Modal, il prend le focus et le
   * rend à la fermeture ; sinon il accompagne la vue sans la bloquer. Échap, Espace, la
   * croix et un clic dans le vide autour de lui le referment toujours (dismiss.ts). L'en-tête
   * reste en place quelle que soit la hauteur : seul le corps défile.
   */
  import { onMount, type Snippet } from 'svelte';
  import { dismissKey, inVoid, isTap, isTopOverlay, openOverlay, outsideBox } from './dismiss';

  interface Props {
    id: string;
    eyebrow?: string;
    title: string;
    closeLabel: string;
    modal?: boolean;
    /**
     * Modal panels make the page inert by default. Off, the panel still owns focus and the
     * keyboard, but the 3D watch beside it can be turned with the pointer.
     */
    inertPage?: boolean;
    /**
     * « side » : centré à droite ; « stage » : sous les outils de la vue 3D ;
     * « center » : au milieu de la page, sur un voile flouté (À propos).
     */
    placement?: 'side' | 'stage' | 'center';
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
    inertPage = true,
    placement = 'side',
    onclose,
    children,
    toolbar,
    footer,
  }: Props = $props();
  let dialog: HTMLDialogElement;
  let heading: HTMLHeadingElement;

  /** This panel in the stack of open overlays. */
  const overlay = {};

  onMount(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const leaveStack = openOverlay(overlay);
    // Capture phase: the click is caught before the page acts on it (grid, 3D view, toggles).
    window.addEventListener('pointerdown', pressOutside, true);
    window.addEventListener('click', clickOutside, true);
    if (modal) {
      if (inertPage) dialog.showModal();
      else dialog.show();
      heading.focus();
    } else {
      dialog.show();
      // show() déplace le focus dans le panneau : la vue 3D le garde, avec ses raccourcis
      // (Espace pour refermer l'aperçu, flèches pour tourner la montre).
      if (previousFocus?.isConnected && previousFocus !== document.body)
        previousFocus.focus({ preventScroll: true });
    }
    return () => {
      leaveStack();
      window.removeEventListener('pointerdown', pressOutside, true);
      window.removeEventListener('click', clickOutside, true);
      dialog.close();
      if ((modal || closedFromInside) && previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  });

  /** Closed from inside (Escape, Space, ×), a side panel hands the keyboard back too. */
  let closedFromInside = false;
  function dismiss() {
    closedFromInside = dialog.contains(document.activeElement);
    onclose();
  }

  /** Outside the panel: elsewhere on the page, or on a modal panel's backdrop. */
  function outside(event: MouseEvent): boolean {
    const target = event.target;
    if (!(target instanceof Node) || !dialog.contains(target)) return true;
    return target === dialog && outsideBox(event, dialog.getBoundingClientRect());
  }

  /** Where the pointer went down outside the panel, if it did. */
  let pressed: { clientX: number; clientY: number } | null = null;
  function pressOutside(event: PointerEvent) {
    pressed =
      event.isPrimary && event.button === 0 && isTopOverlay(overlay) && outside(event)
        ? { clientX: event.clientX, clientY: event.clientY }
        : null;
  }

  /**
   * A click in the void closes the panel, and only that: the page behind does not act on it.
   * A drag (turning the watch, the bezel) or a click from the keyboard leaves it open. Beside
   * a companion panel (not modal), the page's controls keep working and leave it open too.
   */
  function clickOutside(event: MouseEvent) {
    const start = pressed;
    pressed = null;
    if (!start || !isTopOverlay(overlay) || !outside(event) || !isTap(start, event)) return;
    if (!modal && !inVoid(event.target)) return;
    // The header's actions (card, sharing) take over from the panel themselves.
    if ((event.target as Element).closest?.('[data-takes-over]')) return;
    event.preventDefault();
    event.stopPropagation();
    onclose();
  }
</script>

<svelte:window
  onkeydown={(event) => {
    // Turning the watch moves focus out of the panel: Escape and Space still close it.
    if (modal && !inertPage && isTopOverlay(overlay) && dismissKey(event)) {
      event.preventDefault();
      onclose();
    }
  }}
/>

<dialog
  bind:this={dialog}
  class="sheet {placement}"
  aria-labelledby={id}
  oncancel={(event) => {
    event.preventDefault();
    onclose();
  }}
  onkeydown={(event) => {
    // Every panel closes itself with Escape or Space (a dialog opened with show() never
    // receives `cancel`), rather than the view behind it.
    if (dismissKey(event)) {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
      return;
    }
    // Modal, the panel owns the keyboard; otherwise the 3D view keeps its shortcuts.
    if (modal) event.stopPropagation();
  }}
>
  <div class="frame">
    <header>
      <div>
        {#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
        <h2 {id} tabindex="-1" bind:this={heading}>{title}</h2>
      </div>
      <button type="button" class="close" aria-label={closeLabel} onclick={dismiss}>×</button>
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
    /* Secondary text: the faintest ink that still reads at 4.5:1 on either tone. */
    --ink-soft: color-mix(in srgb, var(--ink) 66%, var(--veil));
    /* The panel keeps to the band between the app's header and the bottom of the window,
       centred in it: however tall its content, the header with its close button stays in
       view and only the body scrolls. */
    --sheet-top: var(--chrome-top, 84px);
    --sheet-max: max(160px, calc(100dvh - var(--sheet-top) - 24px - env(safe-area-inset-bottom)));
    position: fixed;
    /* Above the app's fixed header and footer, should they ever meet. */
    z-index: 11;
    inset: calc(var(--sheet-top) + var(--sheet-max) / 2) calc(24px + env(safe-area-inset-right))
      auto auto;
    translate: 0 -50%;
    margin: 0;
    width: 340px;
    max-width: calc(100vw - 32px);
    max-height: var(--sheet-max);
    padding: 24px;
    box-sizing: border-box;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
    border-radius: var(--radius-l);
    background: var(--veil);
    color: var(--ink);
    box-shadow: 0 16px 80px #0003;
    font: inherit;
  }
  dialog[open] {
    display: flex;
    flex-direction: column;
  }
  :global(:root[data-tone='dark']) dialog {
    --ink: #f4f3ef;
    --veil: #25282c;
  }
  dialog.stage {
    --sheet-top: calc(var(--chrome-top, 84px) + 60px);
    --sheet-max: max(160px, calc(100dvh - var(--sheet-top) - 72px - env(safe-area-inset-bottom)));
    top: var(--sheet-top);
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
  dialog.center {
    --sheet-max: calc(100dvh - 48px);
    inset: 0;
    margin: auto;
    translate: none;
    width: min(560px, calc(100vw - 32px));
    max-width: none;
    animation: sheet-rise 200ms ease-out;
  }
  dialog.center::backdrop {
    background: #0004;
    backdrop-filter: blur(8px);
  }
  @keyframes sheet-rise {
    from {
      opacity: 0;
      translate: 0 8px;
    }
  }
  /* The dialog's height is capped: the frame shrinks with it, and the body gives way first. */
  .frame {
    display: flex;
    flex-direction: column;
    min-height: 0;
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
    font-size: var(--text-2xs);
    letter-spacing: 0.16em;
    color: var(--ink-soft);
    margin: 0;
  }
  h2 {
    font-size: var(--text-title);
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
    min-height: var(--control-height);
    line-height: 1;
  }
  footer {
    display: flex;
    margin-top: 24px;
  }

  /* Shared vocabulary for the content of every sheet. The base layer sits under the
     design system's components (kit/Button), which bring their own look. */
  @layer base {
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
  }
  .sheet :global(.section-label) {
    font-size: var(--text-s);
    color: var(--ink-soft);
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
      --sheet-max: 60dvh;
      inset: auto 0 0;
      translate: none;
      width: 100%;
      max-width: 100%;
      border-radius: var(--radius-l) var(--radius-l) 0 0;
      padding: 20px 24px calc(20px + env(safe-area-inset-bottom));
    }
    dialog.stage {
      --sheet-max: 52dvh;
    }
    header {
      margin-bottom: 14px;
    }
    footer {
      margin-top: 16px;
    }
    dialog.center {
      --sheet-max: calc(100dvh - 48px);
      inset: 0;
      width: calc(100vw - 24px);
      border-radius: var(--radius-l);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    dialog.stage,
    dialog.center {
      animation: none;
    }
  }
</style>
