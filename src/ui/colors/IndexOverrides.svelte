<script lang="ts">
  import type { WatchConfig } from '../../core/config/types';
  import {
    INDEX_DESIGNS,
    indexAt,
    type WatchDetails,
    type IndexOverride,
  } from '../../core/config/details';
  import { INDEX_FINISHES } from '../../core/config/colors';
  import { numeralHours } from '../../render2d/dial-print';
  import { complicationHours } from '../../core/config/complications';
  import { i18n } from '../i18n.svelte';
  import { DETAIL_SETTINGS } from './detail-settings';
  import DetailRange from './DetailRange.svelte';
  import ColorField from './ColorField.svelte';
  import SegmentedControl from '../kit/SegmentedControl.svelte';
  import ChoiceGroup from '../kit/ChoiceGroup.svelte';
  let {
    config,
    presets,
    oncommit,
    value,
    onchange,
  }: {
    config: WatchConfig;
    presets: { name: string; color: string }[];
    oncommit: () => void;
    value: NonNullable<WatchDetails['indices']>;
    onchange: (value: NonNullable<WatchDetails['indices']>) => void;
  } = $props();
  const m = $derived(DETAIL_SETTINGS[i18n.locale]);
  let hour = $state(12);
  const key = $derived(String(hour));
  const current = $derived(value[key] ?? {});
  const enabled = $derived(Object.hasOwn(value, key));
  const effective = $derived(
    indexAt({ ...config, details: { ...config.details, indices: value } }, hour % 12),
  );
  const indices = $derived(effective.dial.indices);
  const occupied = $derived(
    [...numeralHours(config.dial.indices.numerals), ...complicationHours(config)].includes(
      hour % 12,
    ),
  );
  function patch(data: IndexOverride) {
    const next = { ...current, ...data };
    for (const k of Object.keys(next) as (keyof IndexOverride)[])
      if (next[k] === undefined) delete next[k];
    onchange({ ...value, [key]: next });
  }
  function toggle(on: boolean) {
    const next = { ...value };
    if (on) next[key] = {};
    else delete next[key];
    onchange(next);
  }
</script>

<details class="index-overrides">
  <summary>{m.individual}</summary>
  <div class="fields">
    <ChoiceGroup
      columns={4}
      label={m.hour}
      value={String(hour)}
      options={[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => ({
        value: String(h),
        label: `${h} h${value[String(h)] ? ' ·' : ''}`,
      }))}
      onchange={(value) => (hour = Number(value))}
    />
    <SegmentedControl
      label={m.customize}
      value={enabled ? 'custom' : 'inherit'}
      options={[
        { value: 'inherit', label: m.inherit },
        { value: 'custom', label: m.customize },
      ]}
      onchange={(mode) => toggle(mode === 'custom')}
    />
    {#if enabled}
      {#if occupied}<p role="status">{m.hidden}</p>{/if}
      <ChoiceGroup
        label={m.design}
        value={current.style ?? 'inherit'}
        options={[
          { value: 'inherit', label: m.inherit },
          ...INDEX_DESIGNS.map((style) => ({ value: style, label: m.styles[style] ?? style })),
        ]}
        onchange={(style) =>
          patch({ style: style === 'inherit' ? undefined : (style as IndexOverride['style']) })}
      />
      <ChoiceGroup
        label={m.finish}
        value={current.finish ?? 'inherit'}
        options={[
          { value: 'inherit', label: m.inherit },
          ...INDEX_FINISHES.map((f) => ({ value: f.id, label: m.finishes[f.id] ?? f.id })),
        ]}
        onchange={(finish) =>
          patch({ finish: finish === 'inherit' ? undefined : (finish as IndexOverride['finish']) })}
      />
      {#if ['applied-lacquer', 'printed'].includes(indices.finish)}<ColorField
          {oncommit}
          {presets}
          label={m.color}
          value={indices.color}
          onchange={(color) => patch({ color })}
        />{/if}
      <DetailRange
        label={m.length}
        value={indices.indexLength}
        min={0.6}
        max={1.6}
        onchange={(indexLength) => patch({ indexLength })}
      />
      <DetailRange
        label={m.width}
        value={indices.indexWidth}
        min={0.6}
        max={1.8}
        onchange={(indexWidth) => patch({ indexWidth })}
      />
      <DetailRange
        label={m.radius}
        value={indices.indexRadius}
        min={0.6}
        max={1.1}
        onchange={(indexRadius) => patch({ indexRadius })}
      />
      <ChoiceGroup
        label={m.lume}
        value={current.lume === undefined ? 'inherit' : (current.lume ?? 'none')}
        options={[
          { value: 'inherit', label: m.inherit },
          { value: 'none', label: m.noLume },
          ...['c3', 'bgw9', 'c1', 'old-radium'].map((pigment) => ({
            value: pigment,
            label: pigment === 'old-radium' ? 'Old Radium' : pigment.toUpperCase(),
          })),
        ]}
        onchange={(lume) =>
          patch({
            lume:
              lume === 'inherit'
                ? undefined
                : lume === 'none'
                  ? null
                  : (lume as IndexOverride['lume']),
          })}
      />
    {/if}
  </div>
</details>

<style>
  .index-overrides {
    border-top: 1px solid var(--control-line);
    margin: 20px 0;
    padding-top: 18px;
  }
  summary {
    cursor: pointer;
    font-size: var(--text-m);
    font-weight: 600;
  }
  .fields {
    display: grid;
    gap: 17px;
    padding-top: 18px;
    min-width: 0;
  }
  p {
    margin: 0;
    font-size: var(--text-s);
    color: var(--ink-soft);
    line-height: 1.5;
  }
</style>
