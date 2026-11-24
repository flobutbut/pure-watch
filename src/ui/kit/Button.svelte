<script lang="ts">
  /**
   * Bouton du design system (documentation/design-system.md).
   * - control : contour sur fond léger, le bouton courant des panneaux ;
   * - primary : plein, à l'encre, pour l'action principale d'un panneau ;
   * - quiet : sans contour, pour les onglets et les commandes posées sur la scène.
   * L'état choisi suit `chosen`, ou à défaut aria-pressed / aria-selected.
   */
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    variant?: 'control' | 'primary' | 'quiet';
    size?: 'regular' | 'compact';
    chosen?: boolean;
    children: Snippet;
  }
  let {
    variant = 'control',
    size = 'regular',
    chosen,
    type = 'button',
    class: extra = '',
    children,
    ...rest
  }: Props = $props();
  const on = $derived(
    chosen ??
      (rest['aria-pressed'] === true ||
        rest['aria-pressed'] === 'true' ||
        rest['aria-selected'] === true ||
        rest['aria-selected'] === 'true'),
  );
</script>

<button {type} class={['button', variant, size, extra, { chosen: on }]} {...rest}>
  {@render children()}
</button>

<style>
  /* Layered: a component's own layout rules (grid cells, columns) always win over these. */
  @layer kit {
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      min-height: var(--control-height);
      padding: 8px 12px;
      border: 1px solid transparent;
      border-radius: var(--radius-s);
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: var(--text-m);
      line-height: 1.2;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition:
        background 160ms,
        border-color 160ms,
        box-shadow 160ms;
    }
    .compact {
      min-height: 36px;
      padding: 7px 10px;
    }
    /* Tones come from currentColor: the same button reads on the panels and on the scene. */
    .control {
      border-color: color-mix(in srgb, currentColor 28%, transparent);
      background: color-mix(in srgb, currentColor 5%, transparent);
    }
    .control:hover:not(:disabled) {
      background: color-mix(in srgb, currentColor 9%, transparent);
    }
    .quiet:hover:not(:disabled) {
      background: color-mix(in srgb, currentColor 8%, transparent);
    }
    .primary {
      border-color: var(--ink);
      background: var(--ink);
      color: var(--veil);
    }
    .primary:hover:not(:disabled) {
      background: color-mix(in srgb, var(--ink) 86%, var(--veil));
    }
    .chosen,
    .chosen:hover:not(:disabled) {
      border-color: currentColor;
      background: color-mix(in srgb, currentColor 12%, transparent);
      box-shadow: inset 0 0 0 1px currentColor;
    }
    .button:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 3px;
    }
    .primary:focus-visible {
      outline-color: var(--ink);
    }
    .button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .button[aria-busy='true'] {
      cursor: progress;
    }
    @media (prefers-reduced-motion: reduce) {
      .button {
        transition: none;
      }
    }
  }
</style>
