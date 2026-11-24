<script lang="ts">
  import {
    LUME_PIGMENTS,
    lumePigment,
    pigmentChoice,
    enableLume,
    type LumeChoice,
  } from '../../core/config/lume';
  import Button from '../kit/Button.svelte';
  import { t } from '../i18n.svelte';

  let {
    value,
    onchange,
    night,
    onnight,
  }: {
    value: LumeChoice;
    onchange: (value: LumeChoice) => void;
    night: boolean;
    onnight: () => void;
  } = $props();
  const pigment = $derived(lumePigment(value.kind));
</script>

<section aria-label={t().lume.title}>
  <p class="section-label">{t().lume.title}</p>
  <div class="choices" role="group" aria-label={t().lume.treatment}>
    <Button aria-pressed={!value.kind} onclick={() => onchange({ ...value, kind: null })}>
      {t().lume.none}
    </Button>
    <Button aria-pressed={Boolean(value.kind)} onclick={() => onchange(enableLume(value))}>
      {t().lume.insert}
    </Button>
  </div>
  {#if value.kind}
    <div class="choices presets" role="group" aria-label={t().lume.pigments}>
      {#each LUME_PIGMENTS as preset (preset.id)}
        <Button
          aria-pressed={pigment?.id === preset.id}
          onclick={() => onchange(pigmentChoice(preset))}
        >
          <span class="sample" style:--day={preset.day} style:--night={preset.night}></span>
          {preset.name}
        </Button>
      {/each}
    </div>
    {#if pigment}
      <div class="pigment-info" aria-live="polite">
        <p>{t().lume[pigment.pair]}</p>
        <p class="performance">
          {t().lume.performanceLabel} : {t().lume.performance[pigment.performance]}
        </p>
      </div>
    {/if}
    <p class="indicative">{t().lume.indicative}</p>
  {/if}
  <Button class="preview" aria-pressed={night} onclick={onnight}>
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.6 15.4A8 8 0 0 1 8.6 4.4a8 8 0 1 0 11 11Z" />
    </svg>
    {t().lume.preview}
  </Button>
</section>

<style>
  section {
    margin: 0 0 22px;
  }
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin-bottom: 12px;
  }
  .sample {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--day) 50%, var(--night) 50%);
    border: 1px solid #8885;
  }
  .presets {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .presets :global(.button) {
    justify-content: flex-start;
  }
  .pigment-info {
    margin-bottom: 12px;
    font-size: var(--text-m);
    line-height: 1.5;
  }
  .pigment-info p {
    margin: 0;
  }
  .performance,
  .indicative {
    color: var(--ink-soft);
    font-size: var(--text-s);
  }
  .indicative {
    line-height: 1.5;
    margin: 12px 0;
  }
  section :global(.preview) {
    width: 100%;
  }
  svg {
    width: 17px;
    height: 17px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
  }
</style>
