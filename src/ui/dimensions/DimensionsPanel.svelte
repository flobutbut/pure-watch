<script lang="ts">
  import { untrack } from 'svelte';
  import {
    CASE_DIMENSIONS,
    caseDimensions,
    caseDimensionsError,
    type CaseDimensions,
  } from '../../core/config/case-dimensions';
  import type { WatchConfig } from '../../core/config/types';
  import Sheet from '../sheet/Sheet.svelte';
  import { formatNumber } from '../../core/i18n/locale';
  import { i18n, t } from '../i18n.svelte';

  let {
    config,
    onpreview,
    onclose,
  }: {
    config: WatchConfig;
    onpreview: (values: CaseDimensions) => void;
    onclose: (values: CaseDimensions) => void;
  } = $props();
  const initial = untrack(() => caseDimensions(config));
  let values = $state({ ...initial });
  let lastValid = { ...initial };
  const error = $derived(caseDimensionsError(config, values, i18n.locale));
  const changed = $derived(CASE_DIMENSIONS.some(({ key }) => values[key] !== initial[key]));
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
  modal
  onclose={close}
>
  <p class="intro">
    {t().dimensions.intro}
  </p>
  <div class="dimensions">
    {#each CASE_DIMENSIONS as field (field.key)}
      {@const label =
        field.key === 'diameterMm' && config.case.shape !== 'round'
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
            oninput={(e) => (values[field.key] = e.currentTarget.valueAsNumber)}
          />
          <span>mm</span>
        </div>
        <input
          type="range"
          aria-label={t().dimensions.adjust(label)}
          min={field.min}
          max={field.max}
          step={field.step}
          value={Number.isFinite(values[field.key]) ? values[field.key] : initial[field.key]}
          aria-valuetext="{display(values[field.key])} mm"
          oninput={(e) => (values[field.key] = e.currentTarget.valueAsNumber)}
        />
      </div>
    {/each}
  </div>
  {#if error}<p class="error" role="alert">
      {error}
      {t().dimensions.lastValid}
    </p>{/if}
  {#snippet footer()}
    <button class="restore" disabled={!changed} onclick={() => (values = { ...initial })}>
      <span aria-hidden="true">↺</span>
      {t().colors.restore}
    </button>
  {/snippet}
</Sheet>

<style>
  .intro {
    font-size: 12px;
    line-height: 1.5;
    opacity: 0.65;
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
    font-size: 12px;
  }
  .value {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
  }
  .value span {
    opacity: 0.6;
  }
  input[type='number'] {
    width: 70px;
    min-height: 36px;
    box-sizing: border-box;
    border: 1px solid var(--control-line);
    border-radius: 8px;
    background: var(--control);
    padding: 7px;
  }
  input[type='range'] {
    grid-column: 1 / -1;
    width: 100%;
    margin: 0;
    accent-color: var(--ink);
  }
  .error {
    font-size: 12px;
    line-height: 1.5;
    margin: 20px 0 0;
  }
  .restore {
    border: 0;
    border-radius: 9px;
    background: var(--control);
    padding: 10px 14px;
    font-size: 12px;
  }
  .restore:disabled {
    opacity: 0.35;
  }
</style>
