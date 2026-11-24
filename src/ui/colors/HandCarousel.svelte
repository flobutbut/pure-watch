<script lang="ts">
  import { tick } from 'svelte';
  import { HAND_STYLES } from '../../core/config/hands';
  import { HAND_GLYPHS } from './hand-glyphs';
  import { PART_SETTINGS } from './part-settings';
  import { i18n } from '../i18n.svelte';
  let {
    value,
    baseStyle,
    label,
    onchange,
  }: { value: string; baseStyle: string; label: string; onchange: (style: string) => void } =
    $props();
  const choices = ['match', ...HAND_STYLES];
  const m = $derived(PART_SETTINGS[i18n.locale]);
  let strip: HTMLDivElement;
  const index = $derived(Math.max(0, choices.indexOf(value as (typeof choices)[number])));
  $effect(() => {
    const selected = index;
    tick().then(() => {
      const button = strip?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[selected];
      if (button)
        strip.scrollTo({
          left: button.offsetLeft - (strip.clientWidth - button.offsetWidth) / 2,
          behavior: 'smooth',
        });
    });
  });
  function move(delta: number) {
    onchange(choices[Math.max(0, Math.min(choices.length - 1, index + delta))]!);
  }
  async function keydown(e: KeyboardEvent, i: number) {
    const next =
      e.key === 'ArrowRight'
        ? Math.min(choices.length - 1, i + 1)
        : e.key === 'ArrowLeft'
          ? Math.max(0, i - 1)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? choices.length - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    e.stopPropagation();
    onchange(choices[next]!);
    await tick();
    strip
      .querySelectorAll<HTMLButtonElement>('[role="radio"]')
      .item(next)
      ?.focus({ preventScroll: true });
  }
</script>

<div class="carousel">
  <div class="carousel-head">
    <span>{m.design}</span>
    <div class="arrows">
      <button
        type="button"
        class="arrow"
        aria-label={`${m.previous} · ${label}`}
        disabled={index === 0}
        onclick={() => move(-1)}
      >
        ←
      </button>
      <button
        type="button"
        class="arrow"
        aria-label={`${m.next} · ${label}`}
        disabled={index === choices.length - 1}
        onclick={() => move(1)}
      >
        →
      </button>
    </div>
  </div>
  <div class="strip" bind:this={strip} role="radiogroup" aria-label={label}>
    {#each choices as style, i (style)}
      <button
        type="button"
        role="radio"
        aria-checked={value === style}
        aria-label={style === 'match' ? m.match : m.styles[style]}
        tabindex={value === style ? 0 : -1}
        onclick={() => onchange(style)}
        onkeydown={(e) => keydown(e, i)}
      >
        <svg viewBox="-10 -70 20 82" aria-hidden="true">
          <path
            d={HAND_GLYPHS[style === 'match' ? baseStyle : style] ?? HAND_GLYPHS.sword}
            fill-rule="evenodd"
          /><circle cx="0" cy="0" r="2.1" />
        </svg>
        <span>{style === 'match' ? m.match : m.styles[style]}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .carousel {
    min-width: 0;
  }
  .carousel-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--text-m);
    margin-bottom: 4px;
  }
  .arrows {
    display: flex;
    gap: 2px;
  }
  .arrow {
    border: 0;
    background: none;
    color: inherit;
    min-width: 32px;
    min-height: 32px;
    font-size: 18px;
    cursor: pointer;
    border-radius: var(--radius-s);
  }
  .arrow:disabled {
    opacity: 0.2;
    cursor: default;
  }
  .strip {
    position: relative;
    display: flex;
    gap: 6px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x proximity;
    scrollbar-width: thin;
    scrollbar-color: var(--control-line) transparent;
    padding: 3px 0 8px;
  }
  .strip button {
    flex: 0 0 78px;
    scroll-snap-align: center;
    border: 1px solid transparent;
    border-radius: var(--radius-m);
    padding: 8px 4px;
    background: none;
    color: var(--ink-soft);
    font: inherit;
    font-size: var(--text-s);
    display: grid;
    justify-items: center;
    align-content: start;
    gap: 7px;
    min-height: 100px;
    cursor: pointer;
  }
  .strip button[aria-checked='true'] {
    color: var(--ink);
    border-color: var(--ink);
    background: color-mix(in srgb, var(--ink) 5%, transparent);
  }
  .strip button:hover {
    color: var(--ink);
  }
  .strip button:focus-visible,
  .arrow:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: -2px;
  }
  svg {
    height: 48px;
    width: 28px;
    fill: currentColor;
  }
  .strip span {
    text-align: center;
    line-height: 1.3;
  }
</style>
