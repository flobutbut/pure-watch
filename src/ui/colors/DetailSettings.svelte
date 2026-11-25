<script lang="ts">
  import type { WatchConfig } from '../../core/config/types';
  import type { WatchDetails } from '../../core/config/details';
  import { dialSurface } from '../../core/config/details';
  import { printInk } from '../../core/config/dial';
  import { rehautColor } from '../../core/config/rehaut';
  import { normalizeHex } from '../../core/config/colors';
  import type { HexColor } from '../../core/config/types';
  import { isDialPatternFinish } from '../../render3d/dial-patterns';
  import { i18n, t } from '../i18n.svelte';
  import { DETAIL_SETTINGS } from './detail-settings';
  import DetailRange from './DetailRange.svelte';
  import ColorField, { CUSTOM } from './ColorField.svelte';
  import SegmentedControl from '../kit/SegmentedControl.svelte';
  let {
    target,
    effectsLabel,
    config,
    presets,
    oncommit,
    value,
    onchange,
  }: {
    target: 'dial' | 'rehaut' | 'powerReserve';
    effectsLabel?: string;
    config: WatchConfig;
    presets: { name: string; color: string }[];
    oncommit: () => void;
    value: WatchDetails;
    onchange: (value: WatchDetails) => void;
  } = $props();
  const m = $derived(DETAIL_SETTINGS[i18n.locale]);
  const surface = $derived(dialSurface({ ...config, details: value }));
  const rehaut = $derived(value.rehaut ?? {});
  const reserve = $derived(value.reserve ?? {});
  function patch<K extends 'dial' | 'rehaut' | 'reserve'>(
    section: K,
    data: Partial<NonNullable<WatchDetails[K]>>,
  ) {
    onchange({ ...value, [section]: { ...value[section], ...data } });
  }
</script>

{#snippet autoColor(
  label: string,
  color: string,
  fallback: string,
  set: (value: HexColor | 'auto') => void,
)}
  <ColorField
    {label}
    {presets}
    {oncommit}
    modes={[
      { value: 'auto', label: m.auto },
      { value: CUSTOM, label: t().colors.custom },
    ]}
    mode={color === 'auto' ? 'auto' : CUSTOM}
    onmode={(mode) => set(mode === 'auto' ? 'auto' : normalizeHex(fallback)!)}
    value={color === 'auto' ? fallback : color}
    onchange={set}
  />
{/snippet}

<section
  class="detail-settings"
  aria-label={target === 'dial'
    ? (effectsLabel ?? m.effects)
    : target === 'rehaut'
      ? m.print
      : m.reserve}
>
  <h3>
    {target === 'dial' ? (effectsLabel ?? m.effects) : target === 'rehaut' ? m.print : m.reserve}
  </h3>
  {#if target === 'dial'}
    <DetailRange
      label={m.fume}
      value={surface.fume}
      min={0}
      max={1}
      onchange={(fume) => patch('dial', { fume })}
    />
    {#if surface.fume > 0}
      {@render autoColor(m.edge, surface.edgeColor, '#111317', (edgeColor) =>
        patch('dial', { edgeColor }),
      )}
    {/if}
    {#if config.dial.finish === 'grained' || isDialPatternFinish(config.dial.finish)}
      <DetailRange
        label={config.dial.finish === 'grained' ? m.grainSize : m.motifSize}
        value={surface.grainSize}
        min={0.4}
        max={2.5}
        onchange={(grainSize) => patch('dial', { grainSize })}
      />
      <DetailRange
        label={m.depth}
        value={surface.grainDepth}
        min={0}
        max={2}
        onchange={(grainDepth) => patch('dial', { grainDepth })}
      />
      <DetailRange
        label={m.roughness}
        value={surface.grainRoughness}
        min={0.3}
        max={1.5}
        onchange={(grainRoughness) => patch('dial', { grainRoughness })}
      />
    {/if}
  {:else if target === 'rehaut'}
    {@render autoColor(m.ink, rehaut.ink ?? 'auto', printInk(rehautColor(config)), (ink) =>
      patch('rehaut', { ink }),
    )}
    <div>
      <p class="section-label">{m.accentAt}</p>
      <SegmentedControl
        label={m.accentAt}
        value={rehaut.accentAt ?? 'none'}
        options={[
          { value: 'none', label: m.none },
          { value: 'zero', label: m.zero },
          { value: 'quarters', label: m.quarters },
        ]}
        onchange={(accentAt) => patch('rehaut', { accentAt })}
      />
    </div>
    {#if rehaut.accentAt && rehaut.accentAt !== 'none'}
      {@render autoColor(
        m.accent,
        rehaut.accent ?? 'auto',
        rehaut.ink && rehaut.ink !== 'auto' ? rehaut.ink : printInk(rehautColor(config)),
        (accent) => patch('rehaut', { accent }),
      )}
    {/if}
    <DetailRange
      label={m.labelSize}
      value={rehaut.labelSize ?? 1}
      min={0.6}
      max={1.6}
      onchange={(labelSize) => patch('rehaut', { labelSize })}
    />
    <DetailRange
      label={m.lineWidth}
      value={rehaut.lineWidth ?? 1}
      min={0.5}
      max={2}
      onchange={(lineWidth) => patch('rehaut', { lineWidth })}
    />
  {:else}
    <DetailRange
      label={m.size}
      value={reserve.size ?? 1}
      min={0.65}
      max={1.4}
      onchange={(size) => patch('reserve', { size })}
    />
    <DetailRange
      label={m.x}
      value={reserve.offsetX ?? 0}
      min={-0.2}
      max={0.2}
      onchange={(offsetX) => patch('reserve', { offsetX })}
    />
    <DetailRange
      label={m.y}
      value={reserve.offsetY ?? 0}
      min={-0.2}
      max={0.2}
      onchange={(offsetY) => patch('reserve', { offsetY })}
    />
  {/if}
</section>

<style>
  .detail-settings {
    display: grid;
    gap: 17px;
    margin: 20px 0;
    border-top: 1px solid var(--control-line);
    padding-top: 18px;
    min-width: 0;
  }
  h3 {
    font-size: var(--text-m);
    margin: 0;
    font-weight: 600;
  }
  p {
    margin: 0;
    font-size: var(--text-s);
    color: var(--ink-soft);
  }
</style>
