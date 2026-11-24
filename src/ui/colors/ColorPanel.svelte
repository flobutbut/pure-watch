<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import {
    colorChoice,
    HAND_FINISHES,
    handColor,
    hexToHsv,
    hsvToHex,
    normalizeHex,
    INDEX_RADIUS_RANGE,
    INDEX_SIZE_RANGE,
    NUMERAL_RADIUS_RANGE,
    NUMERAL_SIZE_RANGE,
    targetColor,
    type ColorChoice,
    type ColorTarget,
  } from '../../core/config/colors';
  import { effectiveDialColor, printInk } from '../../core/config/dial';
  import { REHAUT_FINISHES } from '../../core/config/rehaut';
  import type { HexColor, WatchConfig } from '../../core/config/types';
  import Sheet from '../sheet/Sheet.svelte';
  import { tint } from '../../core/color/names';

  interface Props {
    target: ColorTarget;
    config: WatchConfig;
    presets: { name: string; color: string }[];
    onpreview: (choice: ColorChoice) => void;
    /** Every way out keeps the colour shown on the watch: there is no separate save step. */
    onclose: (choice: ColorChoice) => void;
  }
  let { target, config, presets, onpreview, onclose }: Props = $props();
  const initial = untrack(() => colorChoice(config, target));
  const initialHex = untrack(() =>
    initial.color === 'match' ? targetColor(config, target) : initial.color,
  );
  let hsv = $state(hexToHsv(initialHex));
  let hexInput = $state(initialHex);
  let finish = $state(initial.finish);
  let matched = $state(initial.color === 'match');
  /** Chiffres : taille et distance au centre, réglées dans le même panneau. */
  let size = $state(initial.layout?.size ?? 1);
  let radius = $state(initial.layout?.radius ?? 1);
  let recent = $state<HexColor[]>([]);
  let spectrum = $state<HTMLButtonElement>();
  let pointer: number | null = null;
  const RECENT_KEY = 'epure:recent-colors:v1';
  const ADVANCED_KEY = 'epure:color-advanced:v1';
  /** The HEX field is a power-user tool: folded away unless someone opened it before. */
  let advanced = $state(false);
  const title = $derived(
    target === 'dial'
      ? 'Couleur du cadran'
      : target === 'hands'
        ? 'Matière des aiguilles'
        : target === 'bezel'
          ? 'Couleur de la lunette'
          : target === 'rehaut'
            ? 'Matière et couleur du réhaut'
            : target === 'numerals'
              ? 'Chiffres'
              : target === 'indices'
                ? 'Index'
                : 'Couleur de la trotteuse',
  );
  /** Index : taille et position seulement, leur matière suit la finition appliquée. */
  const colorless = $derived(target === 'indices');
  const ranges = $derived(
    target === 'indices'
      ? { size: INDEX_SIZE_RANGE, radius: INDEX_RADIUS_RANGE }
      : { size: NUMERAL_SIZE_RANGE, radius: NUMERAL_RADIUS_RANGE },
  );
  const free = $derived(
    !colorless &&
      (target === 'rehaut' ? finish === 'custom' : target !== 'hands' || finish === 'lacquer'),
  );
  const color = $derived(hsvToHex(hsv.h, hsv.s, hsv.v));
  const valid = $derived(!free || matched || normalizeHex(hexInput) !== null);
  const choice = $derived<ColorChoice>({
    color: matched ? 'match' : color,
    finish,
    ...(initial.layout ? { layout: { size, radius } } : {}),
  });
  const sameLayout = (a: ColorChoice['layout'], b: ColorChoice['layout']) =>
    Math.abs((a?.size ?? 1) - (b?.size ?? 1)) < 0.005 &&
    Math.abs((a?.radius ?? 1) - (b?.radius ?? 1)) < 0.005;
  /** Slider wording: the reference value is named, the rest read as a share of it. */
  const factor = (value: number) =>
    Math.abs(value - 1) < 0.005 ? 'Standard' : `${Math.round(value * 100)} %`;
  const fill = (value: number, range: { min: number; max: number }) =>
    `${((value - range.min) / (range.max - range.min)) * 100}%`;
  const sameColor = (a: ColorChoice['color'], b: ColorChoice['color']) =>
    a === b || (a !== 'match' && b !== 'match' && normalizeHex(a) === normalizeHex(b));
  const changed = $derived(
    choice.finish !== initial.finish ||
      !sameColor(choice.color, initial.color) ||
      !sameLayout(choice.layout, initial.layout),
  );
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingPreview: ColorChoice;
  function schedulePreview(next: ColorChoice) {
    pendingPreview = next;
    if (previewTimer !== undefined) return;
    // Throttle rather than debounce: the watch also updates during a continuous drag.
    previewTimer = setTimeout(() => {
      previewTimer = undefined;
      onpreview(pendingPreview);
    }, 100);
  }
  $effect(() => schedulePreview(choice));
  const named = $derived(tint(color));

  onMount(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
      if (Array.isArray(stored))
        recent = [
          ...new Set(
            stored
              .filter((v): v is string => typeof v === 'string')
              .map(normalizeHex)
              .filter((v): v is HexColor => v !== null),
          ),
        ].slice(0, 8);
      advanced = localStorage.getItem(ADVANCED_KEY) === 'open';
    } catch {
      /* Private browsing and full storage do not prevent editing. */
    }
    return () => clearTimeout(previewTimer);
  });

  function selectHex(value: string) {
    const hex = normalizeHex(value);
    if (!hex) return;
    const next = hexToHsv(hex);
    // Achromatic colours retain the chosen hue so the surface remains usable.
    hsv = { ...next, h: next.s === 0 ? hsv.h : next.h };
    hexInput = hex;
    matched = false;
  }
  function chooseHsv(h: number, s: number, v: number) {
    hsv = { h, s: Math.max(0, Math.min(100, s)), v: Math.max(0, Math.min(100, v)) };
    hexInput = hsvToHex(hsv.h, hsv.s, hsv.v);
    matched = false;
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
  /** Back to the colour the watch had when the panel opened. */
  function restore() {
    hsv = hexToHsv(initialHex);
    hexInput = initialHex;
    finish = initial.finish;
    matched = initial.color === 'match';
    size = initial.layout?.size ?? 1;
    radius = initial.layout?.radius ?? 1;
  }
  // An unfinished HEX entry is ignored: the last valid colour, still shown on the watch, is kept.
  function close() {
    clearTimeout(previewTimer);
    previewTimer = undefined;
    if (changed && free && !matched) {
      try {
        localStorage.setItem(
          RECENT_KEY,
          JSON.stringify([color, ...recent.filter((c) => c !== color)].slice(0, 8)),
        );
      } catch {
        /* Optional convenience. */
      }
    }
    onclose(changed ? choice : initial);
  }
</script>

<Sheet
  id="color-title"
  eyebrow="PERSONNALISER"
  {title}
  closeLabel="Fermer les couleurs"
  modal
  onclose={close}
>
  {#if target === 'rehaut'}
    <div class="links" role="group" aria-label="Finition du réhaut">
      {#each REHAUT_FINISHES as item (item.id)}
        <button
          type="button"
          class:chosen={finish === item.id}
          aria-pressed={finish === item.id}
          onclick={() => {
            finish = item.id;
          }}
        >
          {item.name}
        </button>
      {/each}
    </div>
  {/if}
  {#if target === 'hands'}
    <div class="finishes" role="group" aria-label="Finition des aiguilles">
      {#each HAND_FINISHES as item (item.id)}
        <button
          type="button"
          class:chosen={finish === item.id}
          aria-pressed={finish === item.id}
          onclick={() => {
            finish = item.id;
          }}
        >
          <span class="dot" style:--swatch={item.color ?? color} class:metal={item.id !== 'lacquer'}
          ></span>{item.name}
        </button>
      {/each}
    </div>
  {/if}

  {#if target === 'seconds'}
    <div class="links" role="group" aria-label="Accords de couleurs">
      <button
        type="button"
        aria-pressed={matched}
        class:chosen={matched}
        onclick={() => {
          matched = true;
        }}
      >
        Assortie aux aiguilles
      </button>
      <button type="button" onclick={() => selectHex(effectiveDialColor(config.dial))}>
        Couleur du cadran
      </button>
    </div>
  {/if}

  {#if initial.layout}
    <div class="layout">
      <label class="slider">
        <span class="slider-head">Taille <span>{factor(size)}</span></span>
        <input
          type="range"
          min={ranges.size.min}
          max={ranges.size.max}
          step="0.01"
          value={size}
          style:--fill={fill(size, ranges.size)}
          aria-valuetext={factor(size)}
          oninput={(event) => (size = Number(event.currentTarget.value))}
        />
      </label>
      <label class="slider">
        <span class="slider-head">Position <span>{factor(radius)}</span></span>
        <input
          type="range"
          min={ranges.radius.min}
          max={ranges.radius.max}
          step="0.01"
          value={radius}
          style:--fill={fill(radius, ranges.radius)}
          aria-valuetext="{factor(radius)} de la distance au centre"
          oninput={(event) => (radius = Number(event.currentTarget.value))}
        />
        <span class="slider-ends" aria-hidden="true"><span>Centre</span><span>Bord</span></span>
      </label>
    </div>
  {/if}
  {#if target === 'numerals'}
    <p class="section-label">Couleur</p>
    <div class="links" role="group" aria-label="Accords de couleurs">
      <button
        type="button"
        aria-pressed={matched}
        class:chosen={matched}
        onclick={() => {
          selectHex(printInk(effectiveDialColor(config.dial)));
          matched = true;
        }}
      >
        Encre du cadran
      </button>
      <button type="button" onclick={() => selectHex(handColor(config))}>
        Couleur des aiguilles
      </button>
      {#if config.hands.second.color !== 'match'}
        <button type="button" onclick={() => selectHex(targetColor(config, 'seconds'))}>
          Couleur de la trotteuse
        </button>
      {/if}
    </div>
  {/if}

  {#if free}
    <div class="palette-section">
      <p class="section-label">Teintes proposées</p>
      <div class="swatches" role="group" aria-label="Teintes proposées">
        {#each presets as preset (preset.color)}
          <button
            type="button"
            class="swatch"
            class:selected={!matched && color === normalizeHex(preset.color)}
            aria-label={preset.name}
            aria-pressed={!matched && color === normalizeHex(preset.color)}
            title={preset.name}
            style:--swatch={preset.color}
            onclick={() => selectHex(preset.color)}
          ></button>
        {/each}
      </div>
    </div>

    {#if recent.length}
      <div class="recent">
        <p class="section-label">Récentes</p>
        <div class="swatches" role="group" aria-label="Couleurs récentes">
          {#each recent as hex (hex)}
            <button
              type="button"
              class="swatch"
              aria-label="Réutiliser {hex}"
              title={tint(hex).name}
              style:--swatch={hex}
              onclick={() => selectHex(hex)}
            ></button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="custom" class:muted={matched}>
      {#if !matched}
        <p class="tint" aria-live="polite">
          <span class="dot" style:--swatch={color}></span>{named.name}
          {#if named.ral}<span class="tint-ref">≈ RAL {named.ral.code}</span>{/if}
        </p>
      {/if}
      <button
        type="button"
        class="spectrum"
        bind:this={spectrum}
        aria-label="Saturation {Math.round(hsv.s)} %, luminosité {Math.round(
          hsv.v,
        )} % : utilisez les flèches, Maj pour un pas de dix"
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
        <span
          class="cursor"
          style:left="{hsv.s}%"
          style:top="{100 - hsv.v}%"
          style:background={color}
        ></span>
      </button>
      <label class="hue-label">
        Teinte <span>{Math.round(hsv.h)}°</span>
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
        <summary>Avancé</summary>
        <label class="hex-label">
          <span>HEX</span><span class="hex-preview" style:background={color}></span>
          <input
            aria-label="Code HEX"
            aria-invalid={!valid}
            aria-describedby={!valid ? 'hex-error' : undefined}
            type="text"
            value={hexInput}
            maxlength="7"
            spellcheck="false"
            autocomplete="off"
            onfocus={(event) =>
              event.currentTarget.parentElement?.scrollIntoView({ block: 'nearest' })}
            oninput={(event) => {
              matched = false;
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
              close();
            }}
            onblur={() => {
              if (normalizeHex(hexInput)) hexInput = color;
            }}
          />
        </label>
        {#if !valid}<p id="hex-error" class="error">
            Saisissez 3 ou 6 caractères : 0–9 ou A–F.
          </p>{/if}
      </details>
    </div>
  {/if}
  {#snippet footer()}
    <button
      type="button"
      class="restore"
      title={initial.layout ? 'Revenir aux réglages d’origine' : 'Revenir à la couleur d’origine'}
      disabled={!changed}
      onclick={restore}
    >
      <span aria-hidden="true">↺</span> Rétablir
    </button>
  {/snippet}
</Sheet>

<style>
  .finishes,
  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin: 0 0 20px;
  }
  .finishes button,
  .links button {
    border: 1px solid var(--control-line);
    border-radius: 10px;
    min-height: 40px;
    background: var(--control);
    padding: 8px 10px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
  }
  .finishes .chosen,
  .links .chosen {
    border-color: var(--ink);
    background: color-mix(in srgb, var(--ink) 12%, transparent);
    box-shadow: inset 0 0 0 1px var(--ink);
  }
  .layout {
    display: grid;
    gap: 18px;
    margin: 0 0 22px;
  }
  .layout:last-child {
    margin-bottom: 0;
  }
  .slider {
    display: block;
    font-size: 11px;
  }
  .slider-head span {
    float: right;
    opacity: 0.6;
  }
  .slider input {
    display: block;
    width: 100%;
    height: 6px;
    margin: 12px 0 0;
    border-radius: 6px;
    appearance: none;
    -webkit-appearance: none;
    background: linear-gradient(
      to right,
      var(--ink) var(--fill),
      color-mix(in srgb, var(--ink) 18%, transparent) var(--fill)
    );
    cursor: pointer;
  }
  .slider input::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--ink);
    border: 3px solid var(--control, #fff);
    box-shadow: 0 1px 4px #0006;
  }
  .slider input::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--ink);
    border: 3px solid var(--control, #fff);
    box-shadow: 0 1px 4px #0006;
  }
  .slider input:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 6px;
  }
  .slider-ends {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
    opacity: 0.55;
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
    border-radius: 10px;
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
    font-size: 11px;
    margin: 16px 0;
  }
  .hue-label span {
    float: right;
    opacity: 0.5;
  }
  input.hue {
    display: block;
    margin: 10px 0 0;
    width: 100%;
    height: 14px;
    border-radius: 10px;
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
    font-size: 11px;
    opacity: 0.6;
  }
  .advanced {
    margin-top: 4px;
  }
  .advanced summary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    font-size: 11px;
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
    border-radius: 9px;
    padding: 8px 10px;
    font-size: 11px;
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
    font-size: 11px;
    margin: 8px 0 0;
  }
  .muted {
    opacity: 0.5;
  }
  .restore {
    min-height: 42px;
    border-radius: 10px;
    padding: 10px 16px;
    font-size: 12px;
    border: 1px solid var(--control-line);
    background: var(--control);
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }
  .restore span {
    font-size: 15px;
    line-height: 1;
  }
  .restore:disabled {
    opacity: 0.45;
    cursor: default;
  }
  @media (max-width: 759px) {
    .finishes {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 5px;
    }
    .finishes button {
      flex-direction: column;
      justify-content: center;
      padding: 7px 3px;
      gap: 5px;
      font-size: 10px;
      min-height: 58px;
      line-height: 1.1;
    }
    .hex-label input {
      font-size: 16px;
    }
    .spectrum {
      height: 100px;
    }
    .finishes,
    .links {
      margin-bottom: 14px;
    }
    .palette-section,
    .recent {
      margin-bottom: 12px;
    }
  }
</style>
