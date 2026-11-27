<script lang="ts">
  import CaseSettings from './CaseSettings.svelte';
  import SegmentedControl from '../kit/SegmentedControl.svelte';
  import {
    caseDraft,
    caseDrawing,
    caseConstruction,
    type CaseDraft,
  } from '../../core/config/case-construction';
  import { untrack } from 'svelte';
  import {
    withCaseDraft,
    CASE_DIMENSIONS,
    caseDimensionsError,
    STRAP_WIDTHS_MM,
    type CaseDimensions,
  } from '../../core/config/case-dimensions';
  import MagneticRange from './MagneticRange.svelte';
  import type { WatchConfig } from '../../core/config/types';
  import RestoreButton from '../kit/RestoreButton.svelte';
  import Sheet from '../sheet/Sheet.svelte';
  import { formatNumber } from '../../core/i18n/locale';
  import { i18n, t } from '../i18n.svelte';

  let {
    config,
    defaults,
    onpreview,
    onclose,
    companion = false,
    initialTab = 'attachments',
  }: {
    config: WatchConfig;
    /** Values of the size chosen in the grid: the sliders' magnetic marks. */
    defaults: { name: string; values: CaseDimensions };
    onpreview: (values: CaseDraft) => void;
    onclose: (values: CaseDraft) => void;
    /** Beside the 3D preview: the view keeps the keyboard (arrows browse the rows). */
    companion?: boolean;
    initialTab?: 'dimensions' | 'attachments' | 'profile' | 'finish';
  } = $props();
  const stopsFor = (key: keyof CaseDimensions) => (key === 'lugWidthMm' ? STRAP_WIDTHS_MM : []);
  function valuetext(key: keyof CaseDimensions, value: number): string {
    const m = t().dimensions;
    const notes = [
      value === defaults.values[key] ? m.atDefault : '',
      (stopsFor(key) as readonly number[]).includes(value) ? m.standardWidth : '',
    ].filter(Boolean);
    return `${display(value)} mm${notes.length ? ` (${notes.join(', ')})` : ''}`;
  }
  const initial = untrack(() => caseDraft(config));
  let tab = $state(untrack(() => initialTab));
  let values = $state({ ...initial });
  let lastValid = { ...initial };
  const draftConfig = $derived(withCaseDraft(config, values));
  const error = $derived(
    caseDimensionsError(
      { ...config, case: { ...config.case, shape: values.shape } },
      values,
      i18n.locale,
    ),
  );
  function dimensionsPatch(key: keyof CaseDimensions, value: number) {
    const next = { ...values, [key]: value };
    const construction = caseConstruction({ ...config, case: { ...config.case, ...next } });
    values = { ...next, construction };
  }
  const changed = $derived(JSON.stringify(values) !== JSON.stringify(initial));
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending = initial;
  $effect(() => {
    if (error) return;
    pending = { ...values };
    lastValid = pending;
    if (timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      onpreview(pending);
    }, 100);
  });
  $effect(() => () => clearTimeout(timer));
  /** Sends what the panel shows now, before the watch moves on (preview). */
  export function flush() {
    clearTimeout(timer);
    timer = undefined;
    onpreview(error ? lastValid : { ...values });
  }
  function close() {
    clearTimeout(timer);
    onclose(error ? lastValid : { ...values });
  }
  const display = (value: number) => formatNumber(value, i18n.locale);
</script>

<Sheet
  id="dimensions-title"
  eyebrow={t().colors.eyebrow}
  title={t().dimensions.title}
  closeLabel={t().dimensions.close}
  modal={!companion}
  inertPage={false}
  placement={companion ? 'stage' : 'side'}
  onclose={close}
>
  {#snippet toolbar()}
    <SegmentedControl
      label={i18n.locale === 'fr' ? 'Paramètres du boîtier' : 'Case settings'}
      value={tab}
      options={[
        { value: 'dimensions', label: i18n.locale === 'fr' ? 'Taille' : 'Size' },
        { value: 'attachments', label: i18n.locale === 'fr' ? 'Dessus' : 'Top' },
        { value: 'profile', label: i18n.locale === 'fr' ? 'Profil' : 'Profile' },
        { value: 'finish', label: i18n.locale === 'fr' ? 'Détails' : 'Details' },
      ]}
      onchange={(value) => (tab = value)}
    />
  {/snippet}
  {#if tab !== 'dimensions'}
    <CaseSettings
      mode={tab}
      config={draftConfig}
      ondrawing={(lugs) =>
        (values = {
          ...values,
          lugs,
          construction: caseDrawing(values.construction, values.diameterMm, lugs),
        })}
      value={values.construction}
      guard={values.crownGuard}
      onchange={(construction) => (values = { ...values, construction })}
      onguard={(crownGuard) => (values = { ...values, crownGuard })}
    />
  {:else}
    <p class="intro">
      {t().dimensions.intro}
      {t().dimensions.defaultsHint(defaults.name)}
    </p>
    <div class="dimensions">
      {#each CASE_DIMENSIONS as field (field.key)}
        {@const label =
          field.key === 'diameterMm' && values.shape !== 'round'
            ? t().dimensions.nominal
            : t().dimensions[field.key]}
        <div class="dimension">
          <label for="dimension-{field.key}">{label}</label>
          <div class="value">
            <input
              id="dimension-{field.key}"
              type="number"
              min={field.min}
              max={field.max}
              step="any"
              inputmode="decimal"
              value={values[field.key]}
              oninput={(e) => dimensionsPatch(field.key, e.currentTarget.valueAsNumber)}
            />
            <span>mm</span>
          </div>
          <MagneticRange
            label={t().dimensions.adjust(label)}
            min={field.min}
            max={field.max}
            step={field.step}
            value={Number.isFinite(values[field.key]) ? values[field.key] : initial[field.key]}
            defaultValue={defaults.values[field.key]}
            stops={stopsFor(field.key)}
            valuetext={valuetext(field.key, values[field.key])}
            oninput={(value) => dimensionsPatch(field.key, value)}
          />
        </div>
      {/each}
    </div>
  {/if}
  {#if error}<p class="error" role="alert">
      {error}
      {t().dimensions.lastValid}
    </p>{/if}
  {#snippet footer()}
    <RestoreButton disabled={!changed} onclick={() => (values = { ...initial })} />
  {/snippet}
</Sheet>

<style>
  .intro {
    font-size: var(--text-m);
    line-height: 1.5;
    color: var(--ink-soft);
    margin: 0 0 24px;
  }
  .dimensions {
    display: grid;
    gap: 22px;
  }
  .dimension {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 10px;
  }
  label {
    font-size: var(--text-m);
  }
  .value {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: var(--text-s);
  }
  .value span {
    color: var(--ink-soft);
  }
  input[type='number'] {
    width: 70px;
    min-height: 36px;
    box-sizing: border-box;
    border: 1px solid var(--control-line);
    border-radius: var(--radius-s);
    background: var(--control);
    padding: 7px;
  }
  .error {
    font-size: var(--text-m);
    line-height: 1.5;
    margin: 20px 0 0;
  }
</style>
