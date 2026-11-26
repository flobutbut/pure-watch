<script lang="ts">
  import {
    dialRing,
    moveRing,
    RING_RELIEFS,
    ringSliderRange,
    ringSliderValue,
    type RingRelief,
    type RingSlider,
  } from '../../core/config/dial-ring';
  import type { RingSettings } from '../../core/config/details';
  import type { WatchConfig } from '../../core/config/types';
  import SegmentedControl from '../kit/SegmentedControl.svelte';
  import DetailRange from './DetailRange.svelte';
  import { t } from '../i18n.svelte';
  let {
    config,
    onchange,
  }: {
    /** La montre telle que le panneau la montre (anneau compris). */
    config: WatchConfig;
    onchange: (patch: Partial<RingSettings>) => void;
  } = $props();
  const ring = $derived(dialRing(config));
  // Du centre vers le bord : l'intérieur à 0 ferme l'anneau en disque, l'extérieur à 100 %
  // touche le rehaut, la position fait glisser la bande sans changer son épaisseur.
  const sliders = $derived<{ id: RingSlider; label: string }[]>([
    { id: 'inner', label: t().colors.ringInner },
    { id: 'position', label: t().colors.ringPosition },
    { id: 'outer', label: t().colors.ringOuter },
  ]);
</script>

{#if ring}
  <section aria-label={t().colors.ringRelief}>
    <p class="section-label">{t().colors.ringRelief}</p>
    <SegmentedControl
      label={t().colors.ringRelief}
      value={ring.relief}
      options={RING_RELIEFS.map((relief) => ({
        value: relief,
        label: relief === 'raised' ? t().colors.ringRaised : t().colors.ringFlat,
      }))}
      onchange={(relief) => onchange({ relief: relief as RingRelief })}
    />
  </section>
  <section class="ranges" aria-label={t().colors.ringSize}>
    {#each sliders as slider (slider.id)}
      {@const range = ringSliderRange(ring, slider.id)}
      <DetailRange
        label={slider.label}
        value={ringSliderValue(ring, slider.id)}
        min={range.min}
        max={range.max}
        step={0.005}
        onchange={(value) => onchange(moveRing(ring, slider.id, value))}
      />
    {/each}
  </section>
{/if}

<style>
  section {
    margin-bottom: 22px;
  }
  .ranges {
    display: grid;
    gap: 16px;
  }
</style>
