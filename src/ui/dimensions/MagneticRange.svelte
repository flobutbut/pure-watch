<script lang="ts">
  /**
   * Curseur aimanté : la valeur par défaut (repère marqué) et d'éventuels arrêts standards
   * (petits repères) attirent le pouce quand on le fait glisser. Au clavier, les pas restent
   * libres : un arrêt ne doit jamais empêcher d'avancer d'un dixième de millimètre.
   */
  import { snapToStops } from '../../core/config/case-dimensions';

  interface Props {
    id?: string;
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    /** Value of the size chosen in the grid, not the last saved one. */
    defaultValue: number;
    stops?: readonly number[];
    valuetext: string;
    oninput: (value: number) => void;
  }
  let {
    id,
    label,
    min,
    max,
    step,
    value,
    defaultValue,
    stops = [],
    valuetext,
    oninput,
  }: Props = $props();

  /** Approximate thumb width: the track runs from its centre at either end. */
  const THUMB_PX = 16;
  /** Reach of each magnet, in pixels of track: stronger for the default value. */
  const DEFAULT_PX = 10;
  const STOP_PX = 6;

  let input: HTMLInputElement;
  let dragging = false;
  let held: number | null = null;

  const inside = $derived(stops.filter((s) => s >= min && s <= max && s !== defaultValue));
  const at = (v: number) => Math.min(1, Math.max(0, (v - min) / (max - min)));

  function handle(event: Event & { currentTarget: HTMLInputElement }) {
    const raw = event.currentTarget.valueAsNumber;
    let next = raw;
    if (dragging) {
      const perPx = (max - min) / Math.max(1, input.clientWidth - THUMB_PX);
      next = snapToStops(raw, [defaultValue], DEFAULT_PX * perPx);
      if (next === raw) next = snapToStops(raw, inside, STOP_PX * perPx);
      if (next !== raw) event.currentTarget.value = String(next);
      const magnet = next === defaultValue || inside.includes(next) ? next : null;
      // A short pulse when the thumb settles on a stop (phones that support it).
      if (magnet !== null && magnet !== held) navigator.vibrate?.(8);
      held = magnet;
    }
    oninput(next);
  }

  function release() {
    dragging = false;
    held = null;
  }
</script>

<svelte:window onpointerup={release} onpointercancel={release} />

<div class="range">
  <input
    {id}
    bind:this={input}
    type="range"
    aria-label={label}
    {min}
    {max}
    {step}
    {value}
    aria-valuetext={valuetext}
    onpointerdown={() => (dragging = true)}
    oninput={handle}
  />
  <div class="marks" aria-hidden="true">
    {#each inside as stop (stop)}
      <span class="stop" class:on={value === stop} style:--at={at(stop)}></span>
    {/each}
    <span class="default" class:on={value === defaultValue} style:--at={at(defaultValue)}></span>
  </div>
</div>

<style>
  .range {
    grid-column: 1 / -1;
  }
  input {
    display: block;
    width: 100%;
    margin: 0;
    accent-color: var(--ink);
  }
  .marks {
    position: relative;
    height: 12px;
    margin: 2px calc(var(--thumb, 16px) / 2) 0;
  }
  .marks span {
    position: absolute;
    top: 0;
    left: calc(var(--at) * 100%);
    translate: -50% 0;
    border-radius: 1px;
    background: var(--ink);
    transition:
      opacity 120ms,
      height 120ms;
  }
  .stop {
    width: 1px;
    height: 5px;
    opacity: 0.3;
  }
  .stop.on {
    height: 7px;
    opacity: 0.8;
  }
  .default {
    width: 2px;
    height: 9px;
    opacity: 0.55;
  }
  .default.on {
    height: 12px;
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .marks span {
      transition: none;
    }
  }
</style>
