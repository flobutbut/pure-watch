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
  import ChoiceGroup from '../kit/ChoiceGroup.svelte';
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
    <ChoiceGroup
      label={m.bezelShape}
      value={value.shape}
      options={BEZEL_SHAPES.map((shape) => ({ value: shape, label: m.shapes[shape] ?? shape }))}
      onchange={(shape) => onchange({ ...value, shape })}
    />
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
    <ChoiceGroup
      label={m.bezelFinish}
      value={value.finish}
      options={BEZEL_FINISHES.map((finish) => ({
        value: finish,
        label: m.finishes[finish] ?? finish,
      }))}
      onchange={(finish) => onchange({ ...value, finish })}
    />
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
  input {
    grid-column: 1/-1;
    width: 100%;
    box-sizing: border-box;
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
