<script lang="ts">
  /** Shared with the hand-design chooser: same scrolling cards, arrows and radio keyboard. */
  import { tick, type Snippet } from 'svelte';
  let {
    value,
    label,
    heading,
    previous,
    next,
    options,
    onchange,
    preview,
  }: {
    value: string;
    label: string;
    heading: string;
    previous: string;
    next: string;
    options: readonly { value: string; label: string }[];
    onchange: (value: string) => void;
    preview: Snippet<[string]>;
  } = $props();
  const choices = $derived(options.map((option) => option.value));
  let strip: HTMLDivElement;
  const index = $derived(Math.max(0, choices.indexOf(value)));
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
    <span>{heading}</span>
    <div class="arrows">
      <button
        type="button"
        class="arrow"
        aria-label={`${previous} · ${label}`}
        disabled={index === 0}
        onclick={() => move(-1)}
      >
        ←
      </button>
      <button
        type="button"
        class="arrow"
        aria-label={`${next} · ${label}`}
        disabled={index === choices.length - 1}
        onclick={() => move(1)}
      >
        →
      </button>
    </div>
  </div>
  <div class="strip" bind:this={strip} role="radiogroup" aria-label={label}>
    {#each options as option, i (option.value)}
      <button
        type="button"
        role="radio"
        aria-checked={value === option.value}
        aria-label={option.label}
        tabindex={value === option.value ? 0 : -1}
        onclick={() => onchange(option.value)}
        onkeydown={(e) => keydown(e, i)}
      >
        <div class="preview">{@render preview(option.value)}</div>
        <span>{option.label}</span>
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
  .preview {
    height: 48px;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .strip span {
    text-align: center;
    line-height: 1.3;
  }
</style>
