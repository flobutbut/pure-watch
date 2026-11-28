<script lang="ts">
  import type { WatchConfig } from '../../core/config/types';
  import {
    chapterMarkDetails,
    chapterMarkGroups,
    CHAPTER_DOT_SIZE_RANGE,
    CHAPTER_TICK_LENGTH_RANGE,
    CHAPTER_TICK_WIDTH_RANGE,
    type ChapterMarkDetails,
    type ChapterMarkGroup,
    type ChapterRingDetails,
    type WatchDetails,
  } from '../../core/config/details';
  import type { RowDef } from '../../core/catalog/types';
  import { chapterRingColor } from '../../core/config/dial';
  import { normalizeHex } from '../../core/config/colors';
  import { SCALE_LABELS } from './scale-labels';
  import { t, i18n } from '../i18n.svelte';
  import ChoiceCarousel from '../kit/ChoiceCarousel.svelte';
  import SegmentedControl from '../kit/SegmentedControl.svelte';
  import DetailRange from './DetailRange.svelte';
  import ColorField, { CUSTOM } from './ColorField.svelte';
  import DetailSettings from './DetailSettings.svelte';
  import ScalePreview from './ScalePreview.svelte';
  let {
    target,
    config,
    settingsRows,
    presets,
    oncommit,
    onchange,
  }: {
    target: 'chapterRing' | 'rehautScale';
    config: WatchConfig;
    settingsRows: RowDef[];
    presets: { name: string; color: string }[];
    oncommit: () => void;
    onchange: (style: string, details: WatchDetails) => void;
  } = $props();
  const m = $derived(SCALE_LABELS[i18n.locale]);
  const rehaut = $derived(target === 'rehautScale');
  const row = $derived(
    settingsRows.find((row) => row.id === (rehaut ? 'rehaut-scale' : 'chapter-ring'))!,
  );
  const style = $derived(rehaut ? config.rehaut.scale : config.dial.chapterRing);
  const details = $derived(config.details ?? {});
  const track = $derived(details.chapterRing ?? {});
  function patch(patch: Partial<ChapterRingDetails>) {
    onchange(style, { ...details, chapterRing: { ...track, ...patch } });
  }
  function patchMark(group: ChapterMarkGroup, mark: ChapterMarkDetails) {
    patch({ [group]: { ...track[group], ...mark } });
  }
</script>

<div class="scale-settings">
  <ChoiceCarousel
    value={style}
    label={m.style}
    heading={m.style}
    previous={m.previous}
    next={m.next}
    options={row.variants.map((variant) => ({
      value: String(variant.value),
      label: variant.i18n.name,
    }))}
    onchange={(style) => onchange(style, details)}
  >
    {#snippet preview(value: string)}<ScalePreview {value} {rehaut} />{/snippet}
  </ChoiceCarousel>
  {#if style === 'none'}<p class="hint">{m.hidden}</p>{/if}
  {#if rehaut}
    <DetailSettings
      target="rehaut"
      {config}
      {presets}
      {oncommit}
      value={details}
      onchange={(details) => onchange(style, details)}
    />
  {:else}
    {#each chapterMarkGroups(style) as group (group)}
      {@const labels = m.marks[group]}
      {@const mark = chapterMarkDetails(track, group)}
      <fieldset class="mark-settings">
        <legend>{labels.name}</legend>
        {#if style === 'dots'}
          <DetailRange
            label={t().colors.dotSize}
            ariaLabel={labels.dotSize}
            value={mark.dotSize ?? 1}
            {...CHAPTER_DOT_SIZE_RANGE}
            onchange={(dotSize) => patchMark(group, { dotSize })}
          />
        {:else}
          <DetailRange
            label={m.markLength}
            ariaLabel={labels.length}
            value={mark.length ?? 1}
            {...CHAPTER_TICK_LENGTH_RANGE}
            onchange={(length) => patchMark(group, { length })}
          />
          <DetailRange
            label={m.markWidth}
            ariaLabel={labels.lineWidth}
            value={mark.lineWidth ?? 1}
            {...CHAPTER_TICK_WIDTH_RANGE}
            onchange={(lineWidth) => patchMark(group, { lineWidth })}
          />
        {/if}
      </fieldset>
    {/each}
    <DetailRange
      label={m.radius}
      value={track.radius ?? 1}
      min={0.6}
      max={1}
      onchange={(radius) => patch({ radius })}
    />
    <div>
      <p class="section-label">{m.accents}</p>
      <SegmentedControl
        label={m.accents}
        value={track.accentAt ?? 'none'}
        options={[
          { value: 'none', label: m.none },
          { value: 'zero', label: m.zero },
          { value: 'quarters', label: m.quarters },
        ]}
        onchange={(accentAt) => patch({ accentAt })}
      />
    </div>
    {#if track.accentAt && track.accentAt !== 'none'}
      <ColorField
        label={m.accent}
        {presets}
        {oncommit}
        value={track.accent && track.accent !== 'auto'
          ? track.accent
          : chapterRingColor(config.dial)}
        modes={[
          { value: 'auto', label: m.auto },
          { value: CUSTOM, label: t().colors.custom },
        ]}
        mode={!track.accent || track.accent === 'auto' ? 'auto' : CUSTOM}
        onmode={(mode) =>
          patch({
            accent: mode === 'auto' ? 'auto' : normalizeHex(chapterRingColor(config.dial))!,
          })}
        onchange={(accent) => patch({ accent })}
      />
    {/if}
  {/if}
</div>

<style>
  .scale-settings {
    display: grid;
    gap: 18px;
    margin-bottom: 20px;
    min-width: 0;
  }
  .hint {
    margin: 0;
    color: var(--ink-soft);
    font-size: var(--text-s);
    line-height: 1.5;
  }
  .mark-settings {
    display: grid;
    gap: 12px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .mark-settings legend {
    margin-bottom: 8px;
    padding: 0;
    font-size: var(--text-m);
    font-weight: 600;
  }
  .section-label {
    margin: 0 0 10px;
  }
</style>
