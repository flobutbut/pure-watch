<script lang="ts">
  import type { WatchConfig } from '../../core/config/types';
  import {
    INDEX_DESIGNS,
    indexAt,
    type WatchDetails,
    type IndexOverride,
  } from '../../core/config/details';
  import { INDEX_FINISHES } from '../../core/config/colors';
  import {
    hourMarkerAt,
    isDoubleIndex,
    type HourMarkers,
    type HourMarker,
  } from '../../core/config/numerals';
  import { MARKER_LABELS } from './marker-labels';
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
    markers = {},
    onmarkers,
    ondouble,
  }: {
    config: WatchConfig;
    presets: { name: string; color: string }[];
    oncommit: () => void;
    value: NonNullable<WatchDetails['indices']>;
    onchange: (value: NonNullable<WatchDetails['indices']>) => void;
    markers?: HourMarkers;
    onmarkers?: (value: HourMarkers) => void;
    ondouble?: (hour: number, double: boolean) => void;
  } = $props();
  const m = $derived(DETAIL_SETTINGS[i18n.locale]);
  const labels = $derived(MARKER_LABELS[i18n.locale]);
  let hour = $state(12);
  const kind = $derived(
    hourMarkerAt({ ...config, details: { ...config.details, hourMarkers: markers } }, hour % 12),
  );
  const blocked = $derived(complicationHours(config).includes(hour % 12));
  function changeKind(kind: string) {
    if (kind === 'inherit') {
      const next = { ...markers };
      delete next[String(hour)];
      onmarkers?.(next);
    } else onmarkers?.({ ...markers, [String(hour)]: kind as HourMarker });
  }
  const key = $derived(String(hour));
  const current = $derived(value[key] ?? {});
  const enabled = $derived(Object.hasOwn(value, key));
  const effective = $derived(
    indexAt({ ...config, details: { ...config.details, indices: value } }, hour % 12),
  );
  const indices = $derived(effective.dial.indices);
  const occupied = $derived(kind !== 'index' || blocked);
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
  <summary>{onmarkers ? labels.individual : m.individual}</summary>
  <div class="fields">
    {#if onmarkers}
      <p>{labels.hint}</p>
      <div class="clock" role="group" aria-label={m.hour}>
        <div class="clock-ring"></div>
        <span class="clock-center" aria-hidden="true">{hour} h</span>
        {#each [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as h (h)}
          {@const marker = hourMarkerAt(
            { ...config, details: { ...config.details, hourMarkers: markers } },
            h % 12,
          )}
          {@const double = marker === 'index' && isDoubleIndex(config, h % 12)}
          {@const name =
            marker === 'numeral'
              ? labels.numeral
              : marker === 'none'
                ? labels.none
                : double
                  ? labels.doubleIndex
                  : labels.index}
          <button
            type="button"
            class:custom={markers[String(h)] || value[String(h)] || double}
            aria-pressed={hour === h}
            aria-label={`${h} h · ${name}`}
            style:left={`${50 + 41 * Math.sin((h / 6) * Math.PI)}%`}
            style:top={`${50 - 41 * Math.cos((h / 6) * Math.PI)}%`}
            onclick={() => (hour = h)}
          >
            <span>{h}</span><span class="kind" aria-hidden="true">
              {marker === 'numeral' ? '12' : marker === 'none' ? '–' : double ? 'Ⅱ' : '│'}
            </span>
          </button>
        {/each}
      </div>
      <p class="selected">{hour} h · {markers[String(hour)] ? labels.custom : labels.inherited}</p>
      <SegmentedControl
        label={labels.kind}
        value={kind}
        options={[
          { value: 'numeral', label: labels.numeral },
          { value: 'index', label: labels.index },
          { value: 'none', label: labels.none },
        ]}
        onchange={changeKind}
      />
      {#if markers[String(hour)]}<button
          type="button"
          class="follow"
          onclick={() => changeKind('inherit')}
        >
          {labels.follow}
        </button>{/if}
      {#if blocked}<p role="status">{labels.occupied}</p>{/if}
    {:else}
      <ChoiceGroup
        columns={4}
        label={m.hour}
        value={String(hour)}
        options={[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => ({
          value: String(h),
          label: `${h} h`,
        }))}
        onchange={(value) => (hour = Number(value))}
      />
    {/if}
    {#if kind === 'index' && ondouble}
      <div class="index-count">
        <p>{labels.indexCount}</p>
        <SegmentedControl
          label={labels.indexCount}
          value={isDoubleIndex(config, hour % 12) ? 'double' : 'single'}
          options={[
            { value: 'single', label: labels.single },
            { value: 'double', label: labels.double },
          ]}
          onchange={(value) => ondouble(hour, value === 'double')}
        />
      </div>
    {/if}
    {#if kind === 'index' || !onmarkers}
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
            patch({
              finish: finish === 'inherit' ? undefined : (finish as IndexOverride['finish']),
            })}
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
    {/if}
  </div>
</details>

<style>
  .clock {
    position: relative;
    width: min(100%, 260px);
    aspect-ratio: 1;
    margin: 0 auto;
  }
  .clock-ring {
    position: absolute;
    inset: 9%;
    border: 1px solid var(--control-line);
    border-radius: 50%;
  }
  .clock-center {
    position: absolute;
    inset: 40%;
    display: grid;
    place-items: center;
    white-space: nowrap;
    font-size: 18px;
  }
  .clock button {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--veil);
    border: 1px solid var(--control-line);
    color: var(--ink);
    cursor: pointer;
    display: grid;
    place-content: center;
    gap: 0;
    font: inherit;
    font-size: 14px;
    line-height: 1.1;
  }
  .clock button[aria-pressed='true'] {
    color: var(--veil);
    background: var(--ink);
    border-color: var(--ink);
  }
  .clock button.custom {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ink) 25%, transparent);
  }
  .clock button:focus-visible,
  .follow:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 3px;
  }
  .kind {
    font-size: 10px;
    opacity: 0.7;
  }
  .selected {
    text-align: center;
  }
  .index-count {
    display: grid;
    gap: 7px;
  }
  .follow {
    background: none;
    border: 0;
    text-decoration: underline;
    cursor: pointer;
    color: var(--ink-soft);
    font: inherit;
    font-size: var(--text-s);
    padding: 8px;
  }
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
