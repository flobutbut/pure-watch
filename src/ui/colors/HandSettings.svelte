<script lang="ts">
  import { HAND_LENGTH, HAND_WIDTH, type HandLayout } from '../../core/config/hands';
  import type { HandAdjustment } from '../../core/config/types';
  import { PART_SETTINGS } from './part-settings';
  import { i18n } from '../i18n.svelte';
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
      <label>
        {m.length} <output>{Math.round(value[key].length * 100)} %</output>
        <input
          type="range"
          aria-label={key === 'hour' ? m.hourLength : m.minuteLength}
          min={HAND_LENGTH[key].min}
          max={HAND_LENGTH[key].max}
          step="0.01"
          value={value[key].length}
          oninput={(e) => change(key, { length: Number(e.currentTarget.value) })}
        />
      </label>
      <label>
        {m.width} <output>{Math.round(value[key].width * 100)} %</output>
        <input
          type="range"
          aria-label={key === 'hour' ? m.hourWidth : m.minuteWidth}
          min={HAND_WIDTH.min}
          max={HAND_WIDTH.max}
          step="0.01"
          value={value[key].width}
          oninput={(e) => change(key, { width: Number(e.currentTarget.value) })}
        />
      </label>
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
  label {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
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
