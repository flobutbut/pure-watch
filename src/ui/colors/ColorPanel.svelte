<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import {
    colorChoice,
    HAND_FINISHES,
    INDEX_FINISHES,
    handColor,
    normalizeHex,
    INDEX_RADIUS_RANGE,
    INDEX_LENGTH_RANGE,
    INDEX_WIDTH_RANGE,
    NUMERAL_RADIUS_RANGE,
    NUMERAL_SIZE_RANGE,
    targetColor,
    withColorChoice,
    type ColorChoice,
    type ColorTarget,
  } from '../../core/config/colors';
  import { effectiveDialColor, printInk, hasIntrinsicColor } from '../../core/config/dial';
  import {
    subdialAppearance,
    subdialBaseColor,
    reserveAppearance,
    ringAppearance,
  } from '../../core/config/subdials';
  import { ringToneColor } from '../../core/config/dial-ring';
  import type { DialSurface, RingSettings } from '../../core/config/details';
  import RingSettingsPanel from './RingSettings.svelte';
  import type { WatchDetails } from '../../core/config/details';
  import type { DialFinish } from '../../core/config/dial-finishes';
  import ChoiceCarousel from '../kit/ChoiceCarousel.svelte';
  import FinishPreview from './FinishPreview.svelte';
  import { PART_SETTINGS } from './part-settings';
  import type { NumeralSystem } from '../../core/config/numerals';
  import { REHAUT_FINISHES } from '../../core/config/rehaut';
  import type { WatchConfig } from '../../core/config/types';
  import Button from '../kit/Button.svelte';
  import SegmentedControl from '../kit/SegmentedControl.svelte';
  import RestoreButton from '../kit/RestoreButton.svelte';
  import Sheet from '../sheet/Sheet.svelte';
  import LumeControls from './LumeControls.svelte';
  import HandSettings from './HandSettings.svelte';
  import type { RowDef } from '../../core/catalog/types';
  import ComplicationSettings from './ComplicationSettings.svelte';
  import SubdialHandSettings from './SubdialHandSettings.svelte';
  import SubdialPrintSettings from './SubdialPrintSettings.svelte';
  import DetailRange from './DetailRange.svelte';
  import { CHAPTER_DOT_SIZE_RANGE } from '../../core/config/details';
  import BezelSettings from './BezelSettings.svelte';
  import StrapSettings from './StrapSettings.svelte';
  import LugSettings from './LugSettings.svelte';
  import DetailSettings from './DetailSettings.svelte';
  import IndexOverrides from './IndexOverrides.svelte';
  import { hasBezelInsert } from '../../core/config/bezel';
  import ColorField, { CUSTOM } from './ColorField.svelte';
  import MaterialField from './MaterialField.svelte';
  import { numeralMaterial } from '../../core/config/material';
  import { i18n, t } from '../i18n.svelte';

  interface Props {
    target: ColorTarget;
    config: WatchConfig;
    presets: { name: string; color: string }[];
    finishes: { value: string; label: string }[];
    settingsRows: RowDef[];
    onpreview: (choice: ColorChoice) => void;
    /** Every way out keeps the colour shown on the watch: there is no separate save step. */
    onclose: (choice: ColorChoice) => void;
    night?: boolean;
    onnight?: () => void;
    /** Beside the 3D preview: the view keeps the keyboard (arrows browse the rows). */
    companion?: boolean;
  }
  let {
    target,
    config,
    presets,
    finishes,
    settingsRows,
    onpreview,
    onclose,
    night = false,
    onnight = () => {},
    companion = false,
  }: Props = $props();
  const initial = untrack(() => colorChoice(config, target));
  const initialHex = untrack(() =>
    initial.color === 'match' ? targetColor(config, target) : initial.color,
  );
  let color = $state(normalizeHex(initialHex)!);
  let finish = $state(initial.finish);
  let matched = $state(initial.color === 'match');
  /**
   * Chiffres et index : taille et distance au centre, réglées dans le même panneau. Pour les
   * index, `size` est la longueur et `width` la largeur.
   */
  let size = $state(initial.layout?.size ?? 1);
  let width = $state(initial.layout?.width ?? 1);
  let radius = $state(initial.layout?.radius ?? 1);
  let numeralSystem = $state<NumeralSystem>(initial.numeralSystem ?? 'arabic');
  let lume = $state(initial.lume);
  let handLayout = $state(initial.handLayout);
  let bezelLayout = $state(initial.bezelLayout);
  let lugJoin = $state(initial.lugJoin);
  let strap = $state(initial.strap);
  let details = $state(initial.details ?? {});
  const initialComplications = untrack(() => config.complications);
  let complications = $state(initialComplications);
  let cyclops = $state(initial.cyclops);
  /** Sous-cadrans et fond de réserve : des complications, avec leur impression et aiguille. */
  const miniTarget = $derived(target === 'subdials' || target === 'powerReserve');
  /** Surfaces à part du fond : finition, couleur et effets propres (l'anneau en est une). */
  const surfaceTarget = $derived(miniTarget || target === 'ring');
  /** Panneaux qui règlent aussi une complication (sa sous-ligne de catalogue). */
  const complicationTarget = $derived(miniTarget || target === 'date');
  const surfaceSection = $derived(
    target === 'powerReserve' ? 'reserve' : target === 'ring' ? 'ring' : 'subdials',
  );
  const surfaceSettings = $derived(details[surfaceSection] ?? undefined);
  function patchSurface(
    patch: {
      finish?: 'original' | DialFinish;
      surface?: Omit<DialSurface, 'legacyFume'>;
    } & Partial<Omit<RingSettings, 'finish' | 'surface'>>,
  ) {
    details = {
      ...details,
      [surfaceSection]: { ...details[surfaceSection], ...patch },
    } as WatchDetails;
  }
  const surfaceFinishLabel = $derived(
    target === 'powerReserve'
      ? t().colors.reserveFinish
      : target === 'ring'
        ? t().colors.ringFinish
        : t().colors.subdialFinish,
  );
  const appearanceOf = (watch: WatchConfig) =>
    target === 'powerReserve'
      ? reserveAppearance(watch)
      : target === 'ring'
        ? ringAppearance(watch)
        : subdialAppearance(watch);
  const title = $derived(
    target === 'subdials' && config.complications.some((c) => c.type === 'chronograph')
      ? t().colors.chronograph
      : t().colors[target],
  );
  const ranges = $derived(
    target === 'indices'
      ? { size: INDEX_LENGTH_RANGE, width: INDEX_WIDTH_RANGE, radius: INDEX_RADIUS_RANGE }
      : { size: NUMERAL_SIZE_RANGE, width: null, radius: NUMERAL_RADIUS_RANGE },
  );
  const free = $derived(
    target === 'strap' || target === 'date'
      ? false
      : surfaceTarget
        ? !hasIntrinsicColor(appearanceOf({ ...config, details }).config.dial.finish)
        : target === 'lugs'
          ? false
          : target === 'bezel'
            ? hasBezelInsert(config)
            : target === 'indices'
              ? (finish === 'printed' && !lume?.kind) || finish === 'applied-lacquer'
              : target === 'rehaut'
                ? finish === 'custom'
                : target !== 'hands' || finish === 'lacquer',
  );
  const choice = $derived<ColorChoice>({
    details,
    ...(strap ? { strap } : {}),
    ...(complicationTarget ? { complications } : {}),
    ...(cyclops !== undefined ? { cyclops } : {}),
    color: matched ? 'match' : color,
    finish,
    ...(initial.layout
      ? { layout: { size, radius, ...(initial.layout.width !== undefined ? { width } : {}) } }
      : {}),
    ...(target === 'numerals' ? { numeralSystem } : {}),
    ...(lume ? { lume } : {}),
    ...(handLayout ? { handLayout } : {}),
    ...(bezelLayout ? { bezelLayout } : {}),
    ...(lugJoin ? { lugJoin } : {}),
  });
  const mini = $derived(
    surfaceTarget ? appearanceOf(withColorChoice(config, target, choice)) : null,
  );
  const miniSurface = $derived(
    surfaceSettings?.surface ??
      Object.fromEntries(
        Object.entries(mini?.config.details?.dial ?? {}).filter(([key]) => key !== 'legacyFume'),
      ),
  );
  const finishOptions = $derived([
    { value: 'original', label: t().colors.originalFinish },
    { value: 'azure', label: t().colors.azureFinish },
    ...finishes,
  ]);
  const sameLayout = (a: ColorChoice['layout'], b: ColorChoice['layout']) =>
    Math.abs((a?.size ?? 1) - (b?.size ?? 1)) < 0.005 &&
    Math.abs((a?.width ?? 1) - (b?.width ?? 1)) < 0.005 &&
    Math.abs((a?.radius ?? 1) - (b?.radius ?? 1)) < 0.005;
  /** Slider wording: the reference value is named, the rest read as a share of it. */
  const factor = (value: number) =>
    Math.abs(value - 1) < 0.005
      ? t().colors.standard
      : `${Math.round(value * 100)}${i18n.locale === 'fr' ? ' ' : ''}%`;
  const fill = (value: number, range: { min: number; max: number }) =>
    `${((value - range.min) / (range.max - range.min)) * 100}%`;
  const sameColor = (a: ColorChoice['color'], b: ColorChoice['color']) =>
    a === b || (a !== 'match' && b !== 'match' && normalizeHex(a) === normalizeHex(b));
  const changed = $derived(
    JSON.stringify(complications) !== JSON.stringify(initialComplications) ||
      choice.cyclops !== initial.cyclops ||
      choice.finish !== initial.finish ||
      !sameColor(choice.color, initial.color) ||
      choice.numeralSystem !== initial.numeralSystem ||
      JSON.stringify(choice.lume) !== JSON.stringify(initial.lume) ||
      JSON.stringify(choice.handLayout) !== JSON.stringify(initial.handLayout) ||
      JSON.stringify(choice.bezelLayout) !== JSON.stringify(initial.bezelLayout) ||
      JSON.stringify(choice.details ?? {}) !== JSON.stringify(initial.details ?? {}) ||
      choice.lugJoin !== initial.lugJoin ||
      JSON.stringify(choice.strap) !== JSON.stringify(initial.strap) ||
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
  /** Sends what the panel shows now, before the watch moves on (preview). */
  export function flush() {
    clearTimeout(previewTimer);
    previewTimer = undefined;
    onpreview(choice);
  }
  onMount(() => () => clearTimeout(previewTimer));
  function selectHex(value: string) {
    const hex = normalizeHex(value);
    if (!hex) return;
    color = hex;
    matched = false;
  }
  /** Back to the colour the watch had when the panel opened. */
  function restore() {
    color = normalizeHex(initialHex)!;
    finish = initial.finish;
    matched = initial.color === 'match';
    size = initial.layout?.size ?? 1;
    width = initial.layout?.width ?? 1;
    radius = initial.layout?.radius ?? 1;
    numeralSystem = initial.numeralSystem ?? 'arabic';
    lume = initial.lume;
    handLayout = initial.handLayout;
    bezelLayout = initial.bezelLayout;
    lugJoin = initial.lugJoin;
    strap = initial.strap;
    details = initial.details ?? {};
    complications = initialComplications;
    cyclops = initial.cyclops;
  }
  /**
   * Couleur de l'élément, selon le pattern `ColorField` : les modes « suivre une autre couleur »
   * puis « Couleur libre ». Les éléments sans mode n'ont que le sélecteur, quand leur finition
   * laisse la couleur libre.
   */
  const linkable = $derived(
    target === 'seconds' || target === 'numerals' || target === 'chapterRing' || surfaceTarget,
  );
  const colorModes = $derived(
    target === 'rehaut'
      ? REHAUT_FINISHES.map((item) => ({ value: item.id, label: t().rehautFinish[item.id]! }))
      : linkable
        ? [
            {
              value: 'match',
              label:
                target === 'ring'
                  ? t().colors.toneOnTone
                  : surfaceTarget
                    ? t().colors.originalColor
                    : target === 'seconds'
                      ? t().colors.matchHands
                      : t().colors.dialInk,
            },
            { value: CUSTOM, label: t().colors.custom },
          ]
        : undefined,
  );
  const colorMode = $derived(target === 'rehaut' ? finish : matched ? 'match' : CUSTOM);
  const colorMatches = $derived(
    target === 'seconds'
      ? [{ label: t().colors.dialColor, color: effectiveDialColor(config.dial) }]
      : linkable
        ? [
            { label: t().colors.handsColor, color: handColor(config) },
            ...(config.hands.second.style !== 'none' && config.hands.second.color !== 'match'
              ? [{ label: t().colors.secondsColor, color: targetColor(config, 'seconds') }]
              : []),
          ]
        : [],
  );
  function chooseMode(mode: string) {
    if (target === 'rehaut') finish = mode as typeof finish;
    else if (mode === CUSTOM) matched = false;
    else {
      if (surfaceTarget)
        selectHex(
          target === 'powerReserve'
            ? effectiveDialColor(config.dial)
            : target === 'ring'
              ? ringToneColor(config)
              : subdialBaseColor(config),
        );
      else if (target !== 'seconds') selectHex(printInk(effectiveDialColor(config.dial)));
      matched = true;
    }
  }
  // An unfinished HEX entry is ignored: the last valid colour, still shown on the watch, is kept.
  function close() {
    clearTimeout(previewTimer);
    previewTimer = undefined;
    onclose(changed ? choice : initial);
  }
</script>

{#snippet elementColor()}
  <ColorField
    label={surfaceTarget
      ? target === 'powerReserve'
        ? t().colors.reserveColor
        : target === 'ring'
          ? t().colors.ringColor
          : t().colors.subdialColor
      : target === 'rehaut'
        ? t().colors.rehautFinish
        : colorModes && t().colors.color}
    value={color}
    {presets}
    modes={colorModes}
    mode={colorMode}
    onmode={chooseMode}
    matches={colorMatches}
    onchange={selectHex}
    oncommit={close}
  />
{/snippet}

<Sheet
  id="color-title"
  eyebrow={t().colors.eyebrow}
  {title}
  closeLabel={t().colors.close}
  modal={!companion}
  inertPage={false}
  placement={companion ? 'stage' : 'side'}
  onclose={close}
>
  {#if strap}<StrapSettings
      value={strap}
      {config}
      {presets}
      onchange={(value) => (strap = value)}
    />{/if}
  {#if target === 'date'}
    <ComplicationSettings
      {settingsRows}
      target="date"
      config={{
        ...config,
        complications,
        details,
        crystal: { ...config.crystal, cyclops: cyclops ?? config.crystal.cyclops },
      }}
      onchange={(value) => {
        complications = value.complications;
        cyclops = value.crystal.cyclops;
      }}
      ondetails={(value) => (details = value)}
    />
  {/if}
  {#if target === 'ring'}
    <RingSettingsPanel config={{ ...config, details }} onchange={(patch) => patchSurface(patch)} />
  {/if}
  {#if surfaceTarget}
    {#if miniTarget}
      <ComplicationSettings
        {settingsRows}
        target={target === 'powerReserve' ? 'reserve' : 'subdials'}
        config={{ ...config, complications, details }}
        onchange={(value) => (complications = value.complications)}
        ondetails={(value) => (details = value)}
      />
    {/if}
    <ChoiceCarousel
      label={surfaceFinishLabel}
      heading={surfaceFinishLabel}
      previous={PART_SETTINGS[i18n.locale].previous}
      next={PART_SETTINGS[i18n.locale].next}
      value={surfaceSettings?.finish ??
        (mini?.config.dial.finish === 'azure' ? 'azure' : 'original')}
      options={finishOptions}
      onchange={(finish) => patchSurface({ finish: finish as 'original' | DialFinish })}
    >
      {#snippet preview(finish: string)}
        <FinishPreview
          finish={finish === 'original' ? config.dial.finish : finish}
          color={mini?.color ?? config.dial.color}
        />
      {/snippet}
    </ChoiceCarousel>
    <div class="surface-color">
      {#if free}{@render elementColor()}{:else}<p class="section-label">
          {t().grid.naturalTitle}
        </p>{/if}
    </div>
  {/if}
  {#if surfaceTarget && mini && !hasIntrinsicColor(mini.config.dial.finish)}
    <DetailSettings
      target="dial"
      effectsLabel={target === 'powerReserve'
        ? t().colors.reserveEffects
        : target === 'ring'
          ? t().colors.ringEffects
          : t().colors.subdialEffects}
      config={mini.config}
      {presets}
      oncommit={close}
      value={{ ...details, dial: miniSurface }}
      onchange={(value) => patchSurface({ surface: value.dial })}
    />
  {/if}
  {#if target === 'dial'}
    <DetailSettings
      {target}
      {config}
      {presets}
      oncommit={close}
      value={details}
      onchange={(value) => (details = value)}
    />
  {/if}
  {#if handLayout}
    <HandSettings
      value={handLayout}
      baseStyle={config.hands.set}
      onchange={(value) => (handLayout = value)}
    />
  {/if}
  {#if bezelLayout}
    <BezelSettings value={bezelLayout} {config} onchange={(value) => (bezelLayout = value)} />
  {/if}
  {#if lugJoin}<LugSettings value={lugJoin} onchange={(value) => (lugJoin = value)} />{/if}
  {#if target === 'rehaut'}
    <div class="element-color">{@render elementColor()}</div>
    <DetailSettings
      {target}
      {config}
      {presets}
      oncommit={close}
      value={details}
      onchange={(value) => (details = value)}
    />
  {/if}
  {#if target === 'hands'}
    <p class="settings-heading">{t().colors.handsFinish}</p>
    <div class="finishes" role="group" aria-label={t().colors.handsFinish}>
      {#each HAND_FINISHES as item (item.id)}
        <Button
          aria-pressed={finish === item.id}
          onclick={() => {
            finish = item.id;
          }}
        >
          <span class="dot" style:--swatch={item.color ?? color} class:metal={item.id !== 'lacquer'}
          ></span>{t().handFinish[item.id]}
        </Button>
      {/each}
    </div>
  {/if}

  {#if target === 'indices'}
    <div class="finishes index-finishes" role="group" aria-label={t().lume.indexFinish}>
      {#each INDEX_FINISHES as item (item.id)}
        <Button aria-pressed={finish === item.id} onclick={() => (finish = item.id)}>
          <span class="dot" style:--swatch={item.color ?? color} class:metal={item.color !== null}
          ></span>
          {item.name === 'printed' ? t().lume.printed : t().handFinish[item.name]}
        </Button>
      {/each}
    </div>
  {/if}

  {#if target === 'seconds'}
    <div class="element-color">{@render elementColor()}</div>
  {/if}

  {#if target === 'numerals'}
    <p class="section-label">{t().colors.script}</p>
    <div class="script">
      <SegmentedControl
        label={t().colors.scriptLabel}
        value={numeralSystem}
        options={[
          { value: 'arabic', label: t().colors.arabic },
          { value: 'roman', label: t().colors.roman },
        ]}
        onchange={(system) => (numeralSystem = system)}
      />
    </div>
  {/if}
  {#if initial.layout}
    <div class="layout">
      <label class="slider">
        <span class="slider-head">
          {ranges.width ? t().colors.length : t().colors.size} <span>{factor(size)}</span>
        </span>
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
      {#if ranges.width}
        <label class="slider">
          <span class="slider-head">{t().colors.width} <span>{factor(width)}</span></span>
          <input
            type="range"
            min={ranges.width.min}
            max={ranges.width.max}
            step="0.01"
            value={width}
            style:--fill={fill(width, ranges.width)}
            aria-valuetext={factor(width)}
            oninput={(event) => (width = Number(event.currentTarget.value))}
          />
        </label>
      {/if}
      <label class="slider">
        <span class="slider-head">{t().colors.position} <span>{factor(radius)}</span></span>
        <input
          type="range"
          min={ranges.radius.min}
          max={ranges.radius.max}
          step="0.01"
          value={radius}
          style:--fill={fill(radius, ranges.radius)}
          aria-valuetext={t().colors.positionValue(factor(radius))}
          oninput={(event) => (radius = Number(event.currentTarget.value))}
        />
        <span class="slider-ends" aria-hidden="true">
          <span>{t().colors.center}</span><span>{t().colors.edge}</span>
        </span>
      </label>
    </div>
  {/if}
  {#if target === 'numerals' || target === 'chapterRing'}
    {#if target === 'chapterRing' && config.dial.chapterRing === 'dots'}
      <div class="layout">
        <DetailRange
          label={t().colors.dotSize}
          value={details.chapterRing?.dotSize ?? 1}
          min={CHAPTER_DOT_SIZE_RANGE.min}
          max={CHAPTER_DOT_SIZE_RANGE.max}
          onchange={(dotSize) =>
            (details = { ...details, chapterRing: { ...details.chapterRing, dotSize } })}
        />
      </div>
    {/if}
    {#if target === 'numerals'}
      <MaterialField
        label={t().material.numerals}
        value={details.numerals ?? {}}
        resolved={numeralMaterial(withColorChoice(config, target, choice))}
        follow={t().material.followIndices}
        ink={elementColor}
        {night}
        {onnight}
        onchange={(numerals) => (details = { ...details, numerals })}
      />
    {:else}
      <div class="element-color">{@render elementColor()}</div>
    {/if}
  {/if}

  {#if miniTarget}
    <SubdialPrintSettings
      reserve={target === 'powerReserve'}
      config={withColorChoice(config, target, choice)}
      {presets}
      value={details}
      onchange={(value) => (details = value)}
      oncommit={close}
    />
    <SubdialHandSettings
      reserve={target === 'powerReserve'}
      {config}
      {presets}
      value={details}
      onchange={(value) => (details = value)}
      oncommit={close}
    />
    {#if target === 'powerReserve'}
      <DetailSettings
        {target}
        config={withColorChoice(config, target, choice)}
        {presets}
        oncommit={close}
        value={details}
        onchange={(value) => (details = value)}
      />
    {/if}
  {/if}

  {#if lume}
    <div class:hand-lume={target === 'hands'}>
      <LumeControls value={lume} onchange={(value) => (lume = value)} {night} {onnight} />
    </div>
  {/if}
  {#if target === 'indices'}
    <IndexOverrides
      oncommit={close}
      {presets}
      config={withColorChoice(config, target, choice)}
      value={details.indices ?? {}}
      onchange={(indices) => (details = { ...details, indices })}
    />
  {/if}

  {#if free && !colorModes}{@render elementColor()}{/if}
  {#snippet footer()}
    <RestoreButton
      title={initial.layout ||
      handLayout ||
      bezelLayout ||
      lugJoin ||
      strap ||
      complicationTarget ||
      target === 'ring' ||
      target === 'chapterRing'
        ? t().colors.restoreSettings
        : t().colors.restoreColor}
      disabled={!changed}
      onclick={restore}
    />
  {/snippet}
</Sheet>

<style>
  .settings-heading {
    font-size: var(--text-m);
    font-weight: 600;
    margin: 8px 0 10px;
    border-top: 1px solid var(--control-line);
    padding-top: 20px;
  }
  .hand-lume {
    border-top: 1px solid var(--control-line);
    padding-top: 20px;
    margin-top: 20px;
  }
  .finishes {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin: 0 0 20px;
  }
  .element-color,
  .script {
    margin: 0 0 22px;
  }
  .surface-color {
    margin-top: 20px;
  }
  .element-color:last-child {
    margin-bottom: 0;
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
    font-size: var(--text-s);
  }
  .slider-head span {
    float: right;
    color: var(--ink-soft);
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
    color: var(--ink-soft);
  }
  @media (max-width: 759px) {
    .finishes {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 5px;
    }
    .finishes :global(.button) {
      flex-direction: column;
      justify-content: center;
      padding: 7px 3px;
      gap: 5px;
      font-size: var(--text-xs);
      min-height: 58px;
      line-height: 1.1;
    }
    .index-finishes {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .finishes,
    .element-color {
      margin-bottom: 14px;
    }
  }
</style>
