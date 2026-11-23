<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import {
    colorChoice,
    HAND_FINISHES,
    hexToHsv,
    hsvToHex,
    normalizeHex,
    targetColor,
    type ColorChoice,
    type ColorTarget,
  } from '../../core/config/colors';
  import { effectiveDialColor } from '../../core/config/dial';
  import { REHAUT_FINISHES } from '../../core/config/rehaut';
  import type { HexColor, WatchConfig } from '../../core/config/types';

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
  let recent = $state<HexColor[]>([]);
  let dialog: HTMLDialogElement;
  let heading: HTMLHeadingElement;
  let spectrum = $state<HTMLButtonElement>();
  let pointer: number | null = null;
  const RECENT_KEY = 'epure:recent-colors:v1';
  const title = $derived(
    target === 'dial'
      ? 'Couleur du cadran'
      : target === 'hands'
        ? 'Matière des aiguilles'
        : target === 'bezel'
          ? 'Couleur de la lunette'
          : target === 'rehaut'
            ? 'Matière et couleur du réhaut'
            : 'Couleur de la trotteuse',
  );
  const free = $derived(
    target === 'rehaut' ? finish === 'custom' : target !== 'hands' || finish === 'lacquer',
  );
  const color = $derived(hsvToHex(hsv.h, hsv.s, hsv.v));
  const valid = $derived(!free || matched || normalizeHex(hexInput) !== null);
  const choice = $derived<ColorChoice>({ color: matched ? 'match' : color, finish });
  const sameColor = (a: ColorChoice['color'], b: ColorChoice['color']) =>
    a === b || (a !== 'match' && b !== 'match' && normalizeHex(a) === normalizeHex(b));
  const changed = $derived(
    choice.finish !== initial.finish || !sameColor(choice.color, initial.color),
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

  onMount(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
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
    } catch {
      /* Private browsing and full storage do not prevent editing. */
    }
    dialog.showModal();
    heading.focus();
    return () => {
      clearTimeout(previewTimer);
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
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
  function backdrop(event: MouseEvent) {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      close();
  }
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="color-title"
  oncancel={(event) => {
    event.preventDefault();
    close();
  }}
  onkeydown={(event) => event.stopPropagation()}
  onclick={backdrop}
>
  <form
    onsubmit={(event) => {
      event.preventDefault();
      close();
    }}
  >
    <header>
      <div>
        <p class="eyebrow">PERSONNALISER</p>
        <h2 id="color-title" tabindex="-1" bind:this={heading}>{title}</h2>
      </div>
      <button type="button" class="close" aria-label="Fermer les couleurs" onclick={close}>
        ×
      </button>
    </header>
    <p class="intro">Enregistré automatiquement sur votre montre.</p>
    <div class="body">
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
              <span
                class="dot"
                style:--swatch={item.color ?? color}
                class:metal={item.id !== 'lacquer'}
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
                  title={hex}
                  style:--swatch={hex}
                  onclick={() => selectHex(hex)}
                ></button>
              {/each}
            </div>
          </div>
        {/if}

        {#if matched}
          <p class="match-note">
            La trotteuse suit la matière des aiguilles. Choisissez une teinte pour lui donner sa
            propre couleur.
          </p>
        {/if}
        <div class="custom" class:muted={matched}>
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
              onblur={() => {
                if (normalizeHex(hexInput)) hexInput = color;
              }}
            />
          </label>
          {#if !valid}<p id="hex-error" class="error">
              Saisissez 3 ou 6 caractères : 0–9 ou A–F.
            </p>{/if}
        </div>
      {:else}
        <p class="metal-note">
          {#if target === 'rehaut'}
            Le réhaut suit {finish === 'metal' ? 'la matière du boîtier' : 'la couleur du cadran'}.
            Sélectionnez « Couleur libre » pour choisir sa propre teinte.
          {:else}
            Les reflets et la matière suivent la finition choisie. Sélectionnez « Laqué » pour créer
            une couleur libre.
          {/if}
        </p>
      {/if}
    </div>
    <footer>
      <button
        type="button"
        class="restore"
        title="Revenir à la couleur d’origine"
        disabled={!changed}
        onclick={restore}
      >
        <span aria-hidden="true">↺</span> Rétablir
      </button>
    </footer>
  </form>
</dialog>

<style>
  dialog {
    --ink: light-dark(#20242b, #f4f3ef);
    --veil: light-dark(#faf9f6, #25282c);
    /* Outlined controls need a filled surface to read as buttons on the pale veil. */
    --control: color-mix(in srgb, var(--ink) 5%, transparent);
    --control-line: color-mix(in srgb, var(--ink) 28%, transparent);
    position: fixed;
    inset: 50% 24px auto auto;
    translate: 0 -50%;
    margin: 0;
    width: 340px;
    max-width: calc(100vw - 32px);
    max-height: calc(100dvh - 48px);
    padding: 24px;
    box-sizing: border-box;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
    border-radius: 22px;
    background: var(--veil);
    color: var(--ink);
    box-shadow: 0 16px 80px #0003;
    font: inherit;
  }
  dialog::backdrop {
    background: #0001;
  }
  form {
    display: flex;
    flex-direction: column;
    max-height: calc(100dvh - 98px);
  }
  header,
  .intro,
  footer {
    flex-shrink: 0;
  }
  .body {
    min-height: 0;
    overflow-y: auto;
    padding: 4px;
    margin: -4px;
    scrollbar-width: thin;
  }
  header {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    align-items: center;
  }
  .eyebrow {
    font-size: 9px;
    letter-spacing: 0.16em;
    opacity: 0.5;
    margin: 0 0 8px;
  }
  h2 {
    font-size: 19px;
    line-height: 1.2;
    font-weight: 500;
    margin: 0;
    outline: none;
  }
  .intro {
    font-size: 12px;
    opacity: 0.6;
    margin: 12px 0 20px;
  }
  button,
  input {
    font: inherit;
    color: inherit;
  }
  button {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  button:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 3px;
  }
  .close {
    background: transparent;
    border: 0;
    font-size: 26px;
    font-weight: 300;
    padding: 2px;
    min-width: 36px;
    min-height: 40px;
    line-height: 1;
  }
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
  .dot {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--swatch);
    box-shadow: inset 0 0 0 1px #8885;
  }
  .dot.metal {
    background: linear-gradient(135deg, #fff9, transparent 45%, #0004), var(--swatch);
  }
  .section-label {
    font-size: 11px;
    opacity: 0.65;
    margin: 0 0 8px;
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
  .match-note,
  .metal-note {
    font-size: 12px;
    line-height: 1.6;
    opacity: 0.7;
    margin: 0 0 18px;
  }
  .muted {
    opacity: 0.5;
  }
  footer {
    display: flex;
    margin-top: 24px;
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
    dialog {
      inset: auto 0 0;
      translate: none;
      width: 100%;
      max-width: 100%;
      max-height: 66dvh;
      border-radius: 22px 22px 0 0;
      padding: 20px 24px calc(20px + env(safe-area-inset-bottom));
    }
    .intro {
      margin: 8px 0 14px;
    }
    form {
      max-height: calc(66dvh - 42px - env(safe-area-inset-bottom));
    }
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
    footer {
      margin-top: 16px;
    }
  }
</style>
