<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { hexToHsv, hsvToHex, normalizeHex } from '../../core/config/colors';
  import type { HexColor } from '../../core/config/types';
  import { tint } from '../../core/color/names';
  import { i18n, t } from '../i18n.svelte';

  let {
    value,
    presets,
    onchange,
    oncommit,
  }: {
    value: string;
    presets: { name: string; color: string }[];
    onchange: (value: HexColor) => void;
    oncommit?: () => void;
  } = $props();
  const id = $props.id();
  const initial = untrack(() => value);
  let hsv = $state(hexToHsv(initial));
  let hexInput = $state(initial);
  let recent = $state<HexColor[]>([]);
  let spectrum = $state<HTMLButtonElement>();
  let pointer: number | null = null;
  let advanced = $state(false);
  let lastOutput = initial;
  const RECENT_KEY = 'epure:recent-colors:v1';
  const ADVANCED_KEY = 'epure:color-advanced:v1';
  const color = $derived(hsvToHex(hsv.h, hsv.s, hsv.v));
  const valid = $derived(normalizeHex(hexInput) !== null);
  const named = $derived(tint(color, i18n.locale));
  // A restore or a matching colour selected outside the picker updates its controls too.
  $effect(() => {
    if (value !== lastOutput) {
      hsv = hexToHsv(value);
      hexInput = value;
      lastOutput = value;
    }
  });
  function emit() {
    const next = hsvToHex(hsv.h, hsv.s, hsv.v);
    lastOutput = next;
    onchange(next);
  }
  function storedRecent(): HexColor[] {
    const stored: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(stored)
      ? [
          ...new Set(
            stored
              .filter((v): v is string => typeof v === 'string')
              .map(normalizeHex)
              .filter((v): v is HexColor => v !== null),
          ),
        ].slice(0, 8)
      : [];
  }
  onMount(() => {
    try {
      recent = storedRecent();
      advanced = localStorage.getItem(ADVANCED_KEY) === 'open';
    } catch {
      /* Optional convenience. */
    }
    return () => {
      if (normalizeHex(value) === normalizeHex(initial)) return;
      try {
        const hex = normalizeHex(value);
        if (hex)
          localStorage.setItem(
            RECENT_KEY,
            JSON.stringify([hex, ...storedRecent().filter((c) => c !== hex)].slice(0, 8)),
          );
      } catch {
        /* Private browsing does not prevent editing. */
      }
    };
  });
  function selectHex(value: string) {
    const hex = normalizeHex(value);
    if (!hex) return;
    const next = hexToHsv(hex);
    // Achromatic colours retain the chosen hue so the surface remains usable.
    hsv = { ...next, h: next.s === 0 ? hsv.h : next.h };
    hexInput = hex;
    emit();
  }
  function chooseHsv(h: number, s: number, v: number) {
    hsv = { h, s: Math.max(0, Math.min(100, s)), v: Math.max(0, Math.min(100, v)) };
    hexInput = hsvToHex(hsv.h, hsv.s, hsv.v);
    emit();
  }
  function point(event: PointerEvent) {
    if (!spectrum) return;
    const rect = spectrum.getBoundingClientRect();
    chooseHsv(
      hsv.h,
      ((event.clientX - rect.left) / rect.width) * 100,
      (1 - (event.clientY - rect.top) / rect.height) * 100,
    );
  }
  function pointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    pointer = event.pointerId;
    (event.currentTarget as HTMLButtonElement).setPointerCapture(pointer);
    point(event);
  }
  function spectrumKey(event: KeyboardEvent) {
    const step = event.shiftKey ? 10 : 1;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = delta[event.key];
    if (!move) return;
    event.preventDefault();
    chooseHsv(hsv.h, hsv.s + move[0], hsv.v + move[1]);
  }
</script>

<div class="color-picker">
  <div class="palette-section">
    <p class="section-label">{t().colors.presets}</p>
    <div class="swatches" role="group" aria-label={t().colors.presets}>
      {#each presets as preset (preset.color)}
        <button
          type="button"
          class="swatch"
          class:selected={color === normalizeHex(preset.color)}
          aria-label={preset.name}
          aria-pressed={color === normalizeHex(preset.color)}
          title={preset.name}
          style:--swatch={preset.color}
          onclick={() => selectHex(preset.color)}
        ></button>
      {/each}
    </div>
  </div>

  {#if recent.length}
    <div class="recent">
      <p class="section-label">{t().colors.recent}</p>
      <div class="swatches" role="group" aria-label={t().colors.recentLabel}>
        {#each recent as hex (hex)}
          <button
            type="button"
            class="swatch"
            aria-label={t().colors.reuse(hex)}
            title={tint(hex, i18n.locale).name}
            style:--swatch={hex}
            onclick={() => selectHex(hex)}
          ></button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="custom">
    <p class="tint" aria-live="polite">
      <span class="dot" style:--swatch={color}></span>{named.name}
      {#if named.ral}<span class="tint-ref">≈ RAL {named.ral.code}</span>{/if}
    </p>
    <button
      type="button"
      class="spectrum"
      bind:this={spectrum}
      aria-label={t().colors.spectrum(Math.round(hsv.s), Math.round(hsv.v))}
      style:--hue={hsvToHex(hsv.h, 100, 100)}
      onpointerdown={pointerDown}
      onpointermove={(event) => {
        if (pointer === event.pointerId) point(event);
      }}
      onpointerup={() => {
        pointer = null;
      }}
      onpointercancel={() => {
        pointer = null;
      }}
      onkeydown={spectrumKey}
    >
      <span class="cursor" style:left="{hsv.s}%" style:top="{100 - hsv.v}%" style:background={color}
      ></span>
    </button>
    <label class="hue-label">
      {t().colors.hue} <span>{Math.round(hsv.h)}°</span>
      <input
        class="hue"
        type="range"
        min="0"
        max="359"
        value={hsv.h}
        oninput={(event) => chooseHsv(Number(event.currentTarget.value), hsv.s, hsv.v)}
      />
    </label>
    <details
      class="advanced"
      bind:open={advanced}
      ontoggle={() => {
        try {
          localStorage.setItem(ADVANCED_KEY, advanced ? 'open' : 'closed');
        } catch {
          /* Optional convenience. */
        }
      }}
    >
      <summary>{t().colors.advanced}</summary>
      <label class="hex-label">
        <span>HEX</span><span class="hex-preview" style:background={color}></span>
        <input
          aria-label={t().colors.hexCode}
          aria-invalid={!valid}
          aria-describedby={!valid ? `${id}-error` : undefined}
          type="text"
          value={hexInput}
          maxlength="7"
          spellcheck="false"
          autocomplete="off"
          onfocus={(event) =>
            event.currentTarget.parentElement?.scrollIntoView({ block: 'nearest' })}
          oninput={(event) => {
            hexInput = event.currentTarget.value;
            const hex = normalizeHex(hexInput);
            if (hex) {
              const text = hexInput;
              selectHex(hex);
              hexInput = text;
            }
          }}
          onkeydown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            oncommit?.();
          }}
          onblur={() => {
            if (normalizeHex(hexInput)) hexInput = color;
          }}
        />
      </label>
      {#if !valid}<p id={`${id}-error`} class="error">
          {t().colors.hexError}
        </p>{/if}
    </details>
  </div>
</div>

<style>
  .color-picker {
    min-width: 0;
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }
  .swatch {
    width: 36px;
    height: 36px;
    border: 5px solid transparent;
    border-radius: 50%;
    background: var(--swatch);
    background-clip: padding-box;
    position: relative;
  }
  .swatch::after {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: 50%;
    border: 1px solid #8884;
  }
  .swatch.selected::after {
    inset: -3px;
    border-color: var(--ink);
  }
  .palette-section,
  .recent {
    margin-bottom: 16px;
  }
  .spectrum {
    width: 100%;
    height: 136px;
    display: block;
    padding: 0;
    border: 0;
    border-radius: var(--radius-s);
    position: relative;
    touch-action: none;
    background:
      linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent),
      var(--hue);
  }
  .cursor {
    position: absolute;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 1px 4px #0009;
    translate: -50% -50%;
    pointer-events: none;
  }
  .hue-label {
    display: block;
    font-size: var(--text-s);
    margin: 16px 0;
  }
  .hue-label span {
    float: right;
    color: var(--ink-soft);
  }
  input.hue {
    display: block;
    margin: 10px 0 0;
    width: 100%;
    height: 14px;
    border-radius: var(--radius-s);
    appearance: none;
    -webkit-appearance: none;
    background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
    cursor: pointer;
  }
  input.hue::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 3px solid white;
    background: transparent;
    box-shadow: 0 1px 4px #0007;
  }
  input.hue::-moz-range-thumb {
    width: 15px;
    height: 15px;
    border-radius: 50%;
    border: 3px solid white;
    background: transparent;
    box-shadow: 0 1px 4px #0007;
  }
  .tint {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px;
    font-size: 13px;
  }
  .tint-ref {
    margin-left: auto;
    font-size: var(--text-s);
    color: var(--ink-soft);
  }
  .advanced {
    margin-top: 4px;
  }
  .advanced summary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    font-size: var(--text-s);
    opacity: 0.7;
    cursor: pointer;
    list-style: none;
  }
  .advanced summary::-webkit-details-marker {
    display: none;
  }
  .advanced summary::before {
    content: '›';
    font-size: 14px;
    transition: rotate 150ms;
  }
  .advanced[open] summary::before {
    rotate: 90deg;
  }
  .advanced summary:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 3px;
  }
  .advanced[open] .hex-label {
    margin-top: 6px;
  }
  .hex-label {
    display: flex;
    gap: 10px;
    align-items: center;
    border: 1px solid var(--control-line);
    border-radius: var(--radius-s);
    padding: 8px 10px;
    font-size: var(--text-s);
  }
  .hex-preview {
    width: 18px;
    height: 18px;
    border: 1px solid #8885;
    border-radius: 50%;
    margin-left: auto;
  }
  .hex-label input {
    width: 86px;
    min-width: 0;
    background: transparent;
    border: 0;
    outline-offset: 1px;
    font:
      13px ui-monospace,
      monospace;
    padding: 4px 0;
    text-transform: uppercase;
  }
  .error {
    font-size: var(--text-s);
    margin: 8px 0 0;
  }
  @media (max-width: 759px) {
    .hex-label input {
      font-size: 16px;
    }
    .spectrum {
      height: 100px;
    }
    .palette-section,
    .recent {
      margin-bottom: 12px;
    }
  }
</style>
