<script lang="ts">
  /**
   * Réglage de matière (pattern « Matière » du design system), toujours dans cet ordre :
   * suivre un autre élément ou personnaliser ; la matière (encre, métal, luminescent) ; son
   * effet ; sa teinte. L'encre garde le réglage de couleur du panneau (`ink`).
   */
  import type { Snippet } from 'svelte';
  import {
    MATERIAL_EFFECTS,
    MATERIAL_KINDS,
    METAL_TINTS,
    materialEffect,
    metalTint,
    type MaterialKind,
    type MaterialSettings,
    type ResolvedMaterial,
  } from '../../core/config/material';
  import { LUME_PIGMENTS } from '../../core/config/lume';
  import Button from '../kit/Button.svelte';
  import SegmentedControl from '../kit/SegmentedControl.svelte';
  import MaterialSwatch from './MaterialSwatch.svelte';
  import { t } from '../i18n.svelte';

  let {
    label,
    value,
    resolved,
    follow,
    ink,
    night = false,
    onnight,
    onchange,
  }: {
    label: string;
    value: MaterialSettings;
    /** La matière affichée sur la montre, pour les pastilles. */
    resolved: ResolvedMaterial;
    /** Libellé du mode « suivre un autre élément », s'il existe. */
    follow?: string;
    /** Réglage de couleur de l'encre (ColorField du panneau). */
    ink?: Snippet;
    night?: boolean;
    onnight?: () => void;
    onchange: (value: MaterialSettings) => void;
  } = $props();

  const FOLLOW = 'follow',
    CUSTOM = 'custom';
  const kind = $derived<MaterialKind>(value.kind ?? 'ink');
  const effects = $derived<readonly string[]>(MATERIAL_EFFECTS[kind]);
  const effect = $derived(materialEffect(kind, value.effect));
  /** Teinte des pastilles d'effet : celle que la montre porte. */
  const tone = $derived(
    resolved.kind === 'lume'
      ? resolved.day
      : kind === 'metal'
        ? metalTint(value.metal).color
        : resolved.color,
  );
  /** Une matière choisie repart de ses valeurs par défaut, sauf la teinte de métal. */
  function chooseKind(next: string) {
    const settings: MaterialSettings = { kind: next as MaterialKind };
    if (next === 'metal' && value.metal) settings.metal = value.metal;
    if (next === 'lume' && value.lume) settings.lume = value.lume;
    onchange(settings);
  }
</script>

<section class="material-field" aria-label={label}>
  <p class="section-label">{label}</p>
  {#if follow}
    <SegmentedControl
      {label}
      value={value.follow ? FOLLOW : CUSTOM}
      options={[
        { value: FOLLOW, label: follow },
        { value: CUSTOM, label: t().material.custom },
      ]}
      onchange={(mode) => onchange(mode === FOLLOW ? { follow: 'indices' } : {})}
    />
  {/if}
  {#if !value.follow}
    <SegmentedControl
      label={t().material.kind}
      value={kind}
      options={MATERIAL_KINDS.map((id) => ({ value: id, label: t().material.kinds[id]! }))}
      onchange={chooseKind}
    />
    {#if effects.length}
      <div class="group">
        <p class="section-label">{t().material.effect}</p>
        <div class="choices" role="group" aria-label={t().material.effect}>
          {#each effects as id (id)}
            <Button
              aria-pressed={effect === id}
              onclick={() => onchange({ ...value, kind, effect: id as MaterialSettings['effect'] })}
            >
              <MaterialSwatch {kind} effect={id} color={tone} />
              {t().material.effects[id]}
            </Button>
          {/each}
        </div>
      </div>
    {/if}
    {#if kind === 'metal'}
      <div class="group">
        <p class="section-label">{t().material.metal}</p>
        <div class="choices tints" role="group" aria-label={t().material.metal}>
          {#each METAL_TINTS as tint (tint.id)}
            <Button
              aria-pressed={metalTint(value.metal).id === tint.id}
              onclick={() => onchange({ ...value, kind, metal: tint.id })}
            >
              <MaterialSwatch kind="metal" {effect} color={tint.color} />
              {t().handFinish[tint.label]}
            </Button>
          {/each}
        </div>
      </div>
    {:else if kind === 'lume'}
      <div class="group">
        <p class="section-label">{t().material.pigment}</p>
        <div class="choices tints" role="group" aria-label={t().material.pigment}>
          {#each LUME_PIGMENTS as pigment (pigment.id)}
            <Button
              aria-pressed={resolved.kind === 'lume' && resolved.pigment === pigment.id}
              onclick={() => onchange({ ...value, kind, lume: pigment.id })}
            >
              <MaterialSwatch kind="lume" color={pigment.day} glow={pigment.night} />
              {pigment.name}
            </Button>
          {/each}
        </div>
        {#if onnight}
          <Button class="night" aria-pressed={night} onclick={onnight}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.6 15.4A8 8 0 0 1 8.6 4.4a8 8 0 1 0 11 11Z" />
            </svg>
            {t().lume.preview}
          </Button>
        {/if}
      </div>
    {:else if ink}
      <div class="group">{@render ink()}</div>
    {/if}
  {/if}
</section>

<style>
  .material-field {
    display: grid;
    gap: 12px;
    margin: 0 0 22px;
  }
  .material-field > .section-label {
    margin: 0;
  }
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }
  .tints {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .tints :global(.button) {
    justify-content: flex-start;
  }
  .group :global(.night) {
    width: 100%;
    margin-top: 10px;
  }
  svg {
    width: 17px;
    height: 17px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
  }
</style>
