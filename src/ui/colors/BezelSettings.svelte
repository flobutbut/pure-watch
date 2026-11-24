<script lang="ts">
  import {
    BEZEL_SHAPES,
    BEZEL_FINISHES,
    hasBezelInsert,
    type BezelLayout,
  } from '../../core/config/bezel';
  import type { WatchConfig } from '../../core/config/types';
  import { watchDimensions } from '../../core/geometry/dimensions';
  import { formatNumber } from '../../core/i18n/locale';
  import { i18n } from '../i18n.svelte';
  import { PART_SETTINGS } from './part-settings';
  let {
    value,
    config,
    onchange,
  }: { value: BezelLayout; config: WatchConfig; onchange: (value: BezelLayout) => void } = $props();
  const m = $derived(PART_SETTINGS[i18n.locale]);
  const d = $derived(watchDimensions({ ...config, bezel: { ...config.bezel, ...value } }));
  const mm = (n: number) => `${formatNumber(Number(n.toFixed(2)), i18n.locale)} mm`;
</script>

<div class="bezel-settings">
  {#if !hasBezelInsert(config)}
    <label>
      {m.bezelShape}
      <select
        aria-label={m.bezelShape}
        value={value.shape}
        onchange={(e) => onchange({ ...value, shape: e.currentTarget.value })}
      >
        {#each BEZEL_SHAPES as shape (shape)}<option value={shape}>{m.shapes[shape]}</option>{/each}
      </select>
    </label>
  {:else}<p>{m.circular}</p>{/if}
  <label>
    {m.bezelWidth}<output>{mm(d.bezelWidth)}</output>
    <input
      type="range"
      aria-label={m.bezelWidth}
      min="0.7"
      max="1.8"
      step="0.01"
      value={value.width}
      oninput={(e) => onchange({ ...value, width: Number(e.currentTarget.value) })}
    />
  </label>
  <label>
    {m.bezelHeight}<output>{Math.round(value.height * 100)} %</output>
    <input
      type="range"
      aria-label={m.bezelHeight}
      min="1"
      max="1.6"
      step="0.01"
      value={value.height}
      oninput={(e) => onchange({ ...value, height: Number(e.currentTarget.value) })}
    />
  </label>
  {#if !['ceramic', 'carbon'].includes(config.case.material)}
    <label>
      {m.bezelFinish}
      <select
        aria-label={m.bezelFinish}
        value={value.finish}
        onchange={(e) => onchange({ ...value, finish: e.currentTarget.value })}
      >
        {#each BEZEL_FINISHES as finish (finish)}<option value={finish}>
            {m.finishes[finish]}
          </option>{/each}
      </select>
    </label>
  {/if}
  <p>{m.fit}</p>
</div>

<style>
  .bezel-settings {
    display: grid;
    gap: 18px;
    margin-bottom: 24px;
  }
  label {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 9px;
    font-size: var(--text-m);
  }
  select,
  input {
    grid-column: 1/-1;
    width: 100%;
    box-sizing: border-box;
  }
  select {
    padding: 9px;
    border: 1px solid var(--control-line);
    border-radius: var(--radius-s);
    background: var(--control);
    color: var(--ink);
    font: inherit;
    min-height: 40px;
  }
  input {
    accent-color: var(--ink);
  }
  output,
  p {
    color: var(--ink-soft);
    font-size: var(--text-s);
  }
  p {
    margin: 0;
    line-height: 1.5;
  }
</style>
