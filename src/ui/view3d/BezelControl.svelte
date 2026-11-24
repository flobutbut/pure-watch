<script lang="ts">
  import type { WatchConfig } from '../../core/config/types';
  import { bezelAngle, bezelScale, turnBezel } from '../../core/config/bezel';
  import { t } from '../i18n.svelte';
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

<div class="bezel-control" role="group" aria-label={t().bezel.label}>
  <button
    class:chosen={editing}
    aria-pressed={editing}
    title={t().bezel.editTitle}
    onclick={() => {
      editing = !editing;
      if (editing) onedit();
    }}
  >
    {t().bezel.edit}
  </button>
  <button
    aria-label={t().bezel.ccw}
    title={t().bezel.ccwTitle}
    onclick={() => onchange(turnBezel(config, -3))}
  >
    ↶
  </button>
  {#if !diving}
    <button
      aria-label={t().bezel.cw}
      title={t().bezel.cwTitle}
      onclick={() => onchange(turnBezel(config, 3))}
    >
      ↷
    </button>
  {/if}
  <output aria-label={t().bezel.position}>{angle}°</output>
  <button
    aria-label={t().bezel.reset}
    title={t().bezel.resetTitle}
    disabled={angle === 0}
    onclick={() => onchange(0)}
  >
    0
  </button>
  {#if editing}<span class="hint">
      {t().bezel.hint(diving)}
    </span>{/if}
</div>

<style>
  .bezel-control {
    position: absolute;
    bottom: var(--stage-bottom, calc(76px + env(safe-area-inset-bottom)));
    /* Follows the watch when a side panel moves it off-centre. */
    left: calc(50% + var(--stage-x, 0px));
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
