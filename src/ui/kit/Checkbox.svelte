<script lang="ts">
  /**
   * Case à cocher du design system (documentation/design-system.md) : une case native, pour
   * le clavier et les lecteurs d'écran, dessinée aux tons de l'encre. Le libellé est cliquable.
   * Pour une option isolée (« Ne plus afficher ce message ») ; deux à quatre modes exclusifs
   * restent une SegmentedControl.
   */
  import type { Snippet } from 'svelte';

  interface Props {
    checked?: boolean;
    disabled?: boolean;
    onchange?: (checked: boolean) => void;
    children: Snippet;
  }
  let { checked = $bindable(false), disabled = false, onchange, children }: Props = $props();
</script>

<label class="checkbox" class:disabled>
  <input
    type="checkbox"
    bind:checked
    {disabled}
    onchange={(event) => onchange?.(event.currentTarget.checked)}
  />
  <span class="box" aria-hidden="true">
    <svg viewBox="0 0 16 16"><path d="M3.5 8.4 6.6 11.4 12.5 4.8" /></svg>
  </span>
  <span class="label">{@render children()}</span>
</label>

<style>
  @layer kit {
    .checkbox {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-height: var(--control-height);
      font-size: var(--text-m);
      line-height: 1.3;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    /* La case native reste dans le flux d'accessibilité, invisible : la case dessinée la
       remplace à l'écran. */
    input {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: 0;
      opacity: 0;
      pointer-events: none;
    }
    .box {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
      border-radius: var(--radius-xs);
      background: color-mix(in srgb, currentColor 5%, transparent);
      transition:
        background 160ms,
        border-color 160ms;
    }
    .box svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: var(--veil);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: 0;
      transition: opacity 120ms;
    }
    .checkbox:hover .box {
      border-color: color-mix(in srgb, currentColor 70%, transparent);
    }
    input:checked + .box {
      border-color: var(--ink);
      background: var(--ink);
    }
    input:checked + .box svg {
      opacity: 1;
    }
    input:focus-visible + .box {
      outline: 2px solid var(--ink);
      outline-offset: 3px;
    }
    .disabled {
      opacity: 0.45;
      cursor: default;
    }
    @media (prefers-reduced-motion: reduce) {
      .box,
      .box svg {
        transition: none;
      }
    }
  }
</style>
