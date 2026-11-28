<script lang="ts">
  import type { WatchConfig } from '../../core/config/types';
  import type { WatchDetails } from '../../core/config/details';
  import { indexHours, numeralHours, numeralSystem } from '../../core/config/numerals';
  import { complicationHours } from '../../core/config/complications';
  import {
    colorChoice,
    withColorChoice,
    targetColor,
    normalizeHex,
    INDEX_FINISHES,
    type ColorChoice,
  } from '../../core/config/colors';
  import { lumeChoice } from '../../core/config/lume';
  import { numeralColor } from '../../core/config/dial';
  import { numeralMaterial } from '../../core/config/material';
  import type { RowDef } from '../../core/catalog/types';
  import { t, i18n } from '../i18n.svelte';
  import { MARKER_LABELS } from './marker-labels';
  import ChoiceCarousel from '../kit/ChoiceCarousel.svelte';
  import SegmentedControl from '../kit/SegmentedControl.svelte';
  import Button from '../kit/Button.svelte';
  import DetailRange from './DetailRange.svelte';
  import ColorField, { CUSTOM } from './ColorField.svelte';
  import MaterialField from './MaterialField.svelte';
  import LumeControls from './LumeControls.svelte';
  import IndexOverrides from './IndexOverrides.svelte';
  import MarkerPreview from './MarkerPreview.svelte';
  let {
    config,
    settingsRows,
    presets,
    onchange,
    oncommit,
    night,
    onnight,
  }: {
    config: WatchConfig;
    settingsRows: RowDef[];
    presets: { name: string; color: string }[];
    onchange: (indices: WatchConfig['dial']['indices'], details: WatchDetails) => void;
    oncommit: () => void;
    night: boolean;
    onnight: () => void;
  } = $props();
  let tab = $state('');
  const m = $derived(MARKER_LABELS[i18n.locale]);
  const indices = $derived(config.dial.indices);
  const actualTab = $derived(
    tab || (['none', 'empty'].includes(indices.numerals) ? 'indices' : 'numerals'),
  );
  const details = $derived(config.details ?? {});
  const fonts = $derived(settingsRows.find((r) => r.id === 'numeral-font')!);
  const shapes = $derived(settingsRows.find((r) => r.id === 'indices')!);
  const blocked = $derived(complicationHours(config));
  const numeralHoursShown = $derived(
    numeralHours(indices.numerals, details.hourMarkers).filter((h) => !blocked.includes(h)),
  );
  const hasIndices = $derived(indexHours(config).some((h) => !blocked.includes(h)));
  function patch(patch: Partial<WatchConfig['dial']['indices']>) {
    onchange({ ...indices, ...patch }, details);
  }
  function edit(target: 'numerals' | 'indices', patch: Partial<ColorChoice>) {
    const next = withColorChoice(config, target, { ...colorChoice(config, target), ...patch });
    onchange(next.dial.indices, next.details ?? {});
  }
  function setDouble(hour: number, double: boolean) {
    const doubleIndices = { ...details.doubleIndices };
    if (double) doubleIndices[String(hour)] = true;
    else delete doubleIndices[String(hour)];
    onchange(indices, { ...details, doubleIndices });
  }
</script>

<div class="marker-settings">
  <SegmentedControl
    label={m.appearance}
    value={actualTab}
    options={[
      { value: 'numerals', label: m.numerals },
      { value: 'indices', label: m.indices },
    ]}
    onchange={(value) => (tab = value)}
  />
  {#if actualTab === 'numerals'}
    {#if !numeralHoursShown.length}<p class="hint">{m.noNumerals}</p>{/if}
    <SegmentedControl
      label={t().colors.scriptLabel}
      value={numeralSystem(indices)}
      options={[
        { value: 'arabic', label: t().colors.arabic },
        { value: 'roman', label: t().colors.roman },
      ]}
      onchange={(numeralSystem) => patch({ numeralSystem })}
    />
    <ChoiceCarousel
      value={indices.numeralFont}
      label={m.font}
      heading={m.font}
      previous={m.previous}
      next={m.next}
      options={fonts.variants.map((v) => ({ value: String(v.value), label: v.i18n.name }))}
      onchange={(numeralFont) => patch({ numeralFont })}
    >
      {#snippet preview(value: string)}<MarkerPreview
          kind="font"
          {value}
          roman={numeralSystem(indices) === 'roman'}
        />{/snippet}
    </ChoiceCarousel>
    <DetailRange
      label={t().identity.numeralSize}
      value={indices.numeralSize}
      min={0.7}
      max={1.75}
      onchange={(numeralSize) => patch({ numeralSize })}
    />
    <DetailRange
      label={t().identity.numeralPosition}
      value={indices.numeralRadius}
      min={0.6}
      max={1.1}
      onchange={(numeralRadius) => patch({ numeralRadius })}
    />
    <MaterialField
      label={t().material.numerals}
      value={details.numerals ?? {}}
      resolved={numeralMaterial(config)}
      follow={t().material.followIndices}
      {night}
      {onnight}
      onchange={(numerals) => onchange(indices, { ...details, numerals })}
    >
      {#snippet ink()}
        <ColorField
          label={t().colors.color}
          value={targetColor(config, 'numerals')}
          {presets}
          modes={[
            { value: 'match', label: t().colors.dialInk },
            { value: CUSTOM, label: t().colors.custom },
          ]}
          mode={indices.numeralColor === 'match' ? 'match' : CUSTOM}
          onmode={(mode) =>
            patch({
              numeralColor: mode === 'match' ? 'match' : normalizeHex(numeralColor(config.dial))!,
            })}
          onchange={(numeralColor) => patch({ numeralColor })}
          {oncommit}
        />
      {/snippet}
    </MaterialField>
  {:else}
    {#if !hasIndices}<p class="hint">{m.noIndices}</p>{/if}
    <ChoiceCarousel
      value={indices.style}
      label={m.shape}
      heading={m.shape}
      previous={m.previous}
      next={m.next}
      options={shapes.variants.map((v) => ({ value: String(v.value), label: v.i18n.name }))}
      onchange={(style) => patch({ style })}
    >
      {#snippet preview(value: string)}<MarkerPreview kind="index" {value} />{/snippet}
    </ChoiceCarousel>
    <div class="finishes" role="group" aria-label={t().lume.indexFinish}>
      {#each INDEX_FINISHES as item (item.id)}
        <Button
          aria-pressed={indices.finish === item.id}
          onclick={() => patch({ finish: item.id })}
        >
          <span class="dot" style:background={item.color ?? indices.color}></span>{item.name ===
          'printed'
            ? t().lume.printed
            : t().handFinish[item.name]}
        </Button>
      {/each}
    </div>
    <DetailRange
      label={t().identity.indexLength}
      value={indices.indexLength}
      min={0.6}
      max={1.6}
      onchange={(indexLength) => patch({ indexLength })}
    />
    <DetailRange
      label={t().identity.indexWidth}
      value={indices.indexWidth}
      min={0.6}
      max={1.8}
      onchange={(indexWidth) => patch({ indexWidth })}
    />
    <DetailRange
      label={t().identity.indexPosition}
      value={indices.indexRadius}
      min={0.6}
      max={1.1}
      onchange={(indexRadius) => patch({ indexRadius })}
    />
    {#if indices.finish === 'applied-lacquer' || (indices.finish === 'printed' && !indices.lume)}
      <ColorField
        label={t().colors.color}
        value={indices.color}
        {presets}
        onchange={(color) => patch({ color })}
        {oncommit}
      />
    {/if}
    <LumeControls
      value={lumeChoice(indices)}
      onchange={(lume) => edit('indices', { lume })}
      {night}
      {onnight}
    />
  {/if}
  <IndexOverrides
    {config}
    {presets}
    {oncommit}
    value={details.indices ?? {}}
    onchange={(value) => onchange(indices, { ...details, indices: value })}
    markers={details.hourMarkers ?? {}}
    onmarkers={(hourMarkers) => onchange(indices, { ...details, hourMarkers })}
    ondouble={setDouble}
  />
</div>

<style>
  .marker-settings {
    display: grid;
    gap: 18px;
    min-width: 0;
  }
  .hint {
    margin: 0;
    color: var(--ink-soft);
    font-size: var(--text-s);
    line-height: 1.5;
  }
  .finishes {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
  }
  .finishes :global(.button) {
    justify-content: flex-start;
  }
  .dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid #8885;
    flex-shrink: 0;
  }
</style>
