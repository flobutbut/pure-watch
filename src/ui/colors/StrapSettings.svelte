<script lang="ts">
  import type { StrapConfig, WatchConfig } from '../../core/config/types';
  import {
    STRAP_STYLES,
    BUCKLE_FINISHES,
    type StrapType,
    type StrapLength,
  } from '../../core/config/strap';
  import { STRAP_LABELS } from './strap-settings';
  import { i18n } from '../i18n.svelte';
  import ChoiceGroup from '../kit/ChoiceGroup.svelte';
  import SegmentedControl from '../kit/SegmentedControl.svelte';
  import ColorField from './ColorField.svelte';
  let {
    value,
    config,
    presets,
    onchange,
  }: {
    value: StrapConfig;
    config: WatchConfig;
    presets: { name: string; color: string }[];
    onchange: (value: StrapConfig) => void;
  } = $props();
  const m = $derived(STRAP_LABELS[i18n.locale]);
  const metal = $derived(value.type === 'metal');
  const custom = $derived(value.buckleFinish !== 'case');
  function patch(update: Partial<StrapConfig>) {
    onchange({ ...value, ...update });
  }
</script>

<div class="strap-settings">
  <ChoiceGroup
    label={m.shape}
    value={value.material}
    options={STRAP_STYLES[value.type as StrapType].map((style) => ({
      value: style,
      label: m.styles[style]!,
    }))}
    onchange={(material) => patch({ material })}
  />
  <ChoiceGroup
    label={m.length}
    value={value.length ?? 'standard'}
    options={Object.entries(m.sizes).map(([value, label]) => ({ value, label }))}
    onchange={(length) => patch({ length: length as StrapLength })}
  />
  <label class="taper">
    <span>{m.taper}</span><output>{value.taperMm ?? 4} mm</output><input
      aria-label={m.taper}
      type="range"
      min="0"
      max={Math.min(6, config.case.lugWidthMm - 8)}
      step="1"
      value={value.taperMm ?? 4}
      oninput={(event) => patch({ taperMm: Number(event.currentTarget.value) })}
    />
  </label>
  <p class="note">{m.width} · {config.case.lugWidthMm} mm</p>
  {#if metal}
    <ChoiceGroup
      label={m.metal}
      value={value.color}
      options={[
        { value: '#C9CED6', label: m.finishes.steel },
        { value: '#D3AA54', label: m.finishes['gold-yellow'] },
        { value: '#D7A08A', label: m.finishes['gold-rose'] },
        { value: '#252A30', label: m.finishes.black },
      ]}
      onchange={(color) => patch({ color: color as `#${string}` })}
    />
  {:else}
    <ColorField
      label={m.color}
      value={value.color}
      {presets}
      onchange={(color) => patch({ color: color as `#${string}` })}
    />
  {/if}
  {#if value.type === 'leather'}
    <div>
      <p class="section-label">{m.stitching}</p>
      <SegmentedControl
        label={m.stitching}
        value={value.stitching ? 'on' : 'off'}
        options={[
          { value: 'off', label: m.none },
          { value: 'on', label: m.stitched },
        ]}
        onchange={(mode) => patch({ stitching: mode === 'on' ? '#C8B08A' : null })}
      />
    </div>
    {#if value.stitching}<ColorField
        label={m.stitchColor}
        value={value.stitching}
        {presets}
        onchange={(stitching) => patch({ stitching: stitching as `#${string}` })}
      />{/if}
  {/if}
  {#if !metal}<ChoiceGroup
      label={m.buckle}
      value={value.buckle}
      options={[
        { value: 'tang', label: m.tang },
        { value: 'deployant', label: m.deployant },
      ]}
      onchange={(buckle) => patch({ buckle })}
    />{/if}
  <div class="buckle">
    <p class="section-label">{m.finish}</p>
    <SegmentedControl
      label={m.finish}
      value={custom ? 'custom' : 'case'}
      options={[
        { value: 'case', label: m.case },
        { value: 'custom', label: m.custom },
      ]}
      onchange={(mode) => patch({ buckleFinish: mode === 'case' ? 'case' : 'steel' })}
    />
  </div>
  {#if custom}<ChoiceGroup
      label={m.finish}
      value={value.buckleFinish ?? 'steel'}
      options={BUCKLE_FINISHES.filter((finish) => finish !== 'case').map((finish) => ({
        value: finish,
        label: m.finishes[finish],
      }))}
      onchange={(buckleFinish) =>
        patch({ buckleFinish: buckleFinish as StrapConfig['buckleFinish'] })}
    />{/if}
</div>

<style>
  .strap-settings {
    display: grid;
    gap: 22px;
  }
  .taper {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    font-size: var(--text-s);
  }
  input {
    grid-column: 1/-1;
    width: 100%;
    margin: 0;
    accent-color: var(--ink);
  }
  output,
  .note {
    color: var(--ink-soft);
  }
  .note {
    margin: -10px 0 0;
    font-size: var(--text-s);
    line-height: 1.5;
  }
  .buckle {
    border-top: 1px solid var(--control-line);
    padding-top: 20px;
  }
</style>
