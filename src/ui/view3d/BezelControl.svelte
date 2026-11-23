<script lang="ts">
  import type { WatchConfig } from '../../core/config/types';
  import { bezelAngle, bezelScale, turnBezel } from '../../core/config/bezel';
  let {
    config,
    editing = $bindable(false),
    onchange,
    onedit,
  }: {
    config: WatchConfig;
    editing?: boolean;
    onchange: (angle: number) => void;
    onedit: () => void;
  } = $props();
  const diving = $derived(bezelScale(config) === 'dive-60');
  const angle = $derived(bezelAngle(config.bezel.angleDeg));
</script>

<div class="bezel-control" role="group" aria-label="Réglage de la lunette">
  <button
    class:chosen={editing}
    aria-pressed={editing}
    title="Glisser sur l’anneau pour le tourner (B)"
    onclick={() => {
      editing = !editing;
      if (editing) onedit();
    }}
  >
    Régler la lunette
  </button>
  <button
    aria-label="Tourner la lunette dans le sens antihoraire"
    title="Un cran antihoraire"
    onclick={() => onchange(turnBezel(config, -3))}
  >
    ↶
  </button>
  {#if !diving}
    <button
      aria-label="Tourner la lunette dans le sens horaire"
      title="Un cran horaire"
      onclick={() => onchange(turnBezel(config, 3))}
    >
      ↷
    </button>
  {/if}
  <output aria-label="Position de la lunette">{angle}°</output>
  <button
    aria-label="Réinitialiser la lunette"
    title="Ramener le repère à 12 h"
    disabled={angle === 0}
    onclick={() => onchange(0)}
  >
    0
  </button>
  {#if editing}<span class="hint">
      Glisser sur l’anneau · {diving ? 'sens antihoraire' : 'deux sens'}
    </span>{/if}
</div>

<style>
  .bezel-control {
    position: absolute;
    bottom: calc(76px + env(safe-area-inset-bottom));
    left: 50%;
    transform: translateX(-50%);
    z-index: 8;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    width: max-content;
    max-width: calc(100% - 32px);
    padding: 6px;
    border-radius: 14px;
    background: var(--veil);
    backdrop-filter: blur(14px);
    box-shadow: 0 2px 18px #0001;
    color: var(--ink);
    font-size: 12px;
  }
  button {
    min-width: 36px;
    min-height: 36px;
    padding: 7px 10px;
    border: 0;
    border-radius: 9px;
    color: inherit;
    background: transparent;
    font: inherit;
    cursor: pointer;
  }
  button:hover,
  button.chosen {
    background: color-mix(in srgb, currentColor 10%, transparent);
  }
  button:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: -2px;
  }
  button:disabled {
    opacity: 0.3;
    cursor: default;
  }
  output {
    min-width: 36px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .hint {
    flex-basis: 100%;
    text-align: center;
    opacity: 0.6;
    padding: 0 5px 5px;
    font-size: 10px;
  }
</style>
