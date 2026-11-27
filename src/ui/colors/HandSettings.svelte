<script lang="ts">
  import { HAND_LENGTH, HAND_WIDTH, type HandLayout } from '../../core/config/hands';
  import type { HandAdjustment } from '../../core/config/types';
  import { PART_SETTINGS } from './part-settings';
  import { i18n } from '../i18n.svelte';
  import RangeField from '../kit/RangeField.svelte';
  import HandCarousel from './HandCarousel.svelte';
  let {
    value,
    baseStyle,
    onchange,
  }: { value: HandLayout; baseStyle: string; onchange: (value: HandLayout) => void } = $props();
  const m = $derived(PART_SETTINGS[i18n.locale]);
  function change(part: 'hour' | 'minute', patch: Partial<HandAdjustment>) {
    onchange({ ...value, [part]: { ...value[part], ...patch } });
  }
</script>

<div class="hand-settings">
  {#each ['hour', 'minute'] as part (part)}
    {@const key = part as 'hour' | 'minute'}
    <section aria-label={m[key]}>
      <h3>{m[key]}</h3>
      <HandCarousel
        value={value[key].style}
        {baseStyle}
        label={key === 'hour' ? m.hourDesign : m.minuteDesign}
        onchange={(style) => change(key, { style })}
      />
      <RangeField
        label={m.length}
        ariaLabel={key === 'hour' ? m.hourLength : m.minuteLength}
        min={HAND_LENGTH[key].min}
        max={HAND_LENGTH[key].max}
        value={value[key].length}
        onchange={(length) => change(key, { length })}
      />
      <RangeField
        label={m.width}
        ariaLabel={key === 'hour' ? m.hourWidth : m.minuteWidth}
        min={HAND_WIDTH.min}
        max={HAND_WIDTH.max}
        value={value[key].width}
        onchange={(width) => change(key, { width })}
      />
    </section>
  {/each}
  <p>{m.common}</p>
</div>

<style>
  .hand-settings {
    display: grid;
    gap: 18px;
    margin-bottom: 22px;
  }
  section {
    border: 0;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 15px;
    min-width: 0;
  }
  h3 {
    font-size: var(--text-m);
    font-weight: 600;
    padding: 0;
    margin: 0;
  }
  section + section {
    border-top: 1px solid var(--control-line);
    padding-top: 20px;
    margin-top: 4px;
  }
  p {
    color: var(--ink-soft);
    font-size: var(--text-s);
  }
  p {
    margin: 0;
    line-height: 1.5;
  }
</style>
