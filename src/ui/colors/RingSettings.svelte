<script lang="ts">
  import {
    dialRing,
    RING_DIAMETER_RANGE,
    RING_RELIEFS,
    RING_WIDTH_RANGE,
    type RingRelief,
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
    <DetailRange
      label={t().colors.ringDiameter}
      value={ring.diameter}
      min={RING_DIAMETER_RANGE.min}
      max={RING_DIAMETER_RANGE.max}
      onchange={(diameter) => onchange({ diameter })}
    />
    <!-- Une largeur au moins égale au rayon donne un disque plein. -->
    <DetailRange
      label={t().colors.ringWidth}
      value={Math.min(ring.width, ring.diameter)}
      min={RING_WIDTH_RANGE.min}
      max={ring.diameter}
      onchange={(width) => onchange({ width })}
    />
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
