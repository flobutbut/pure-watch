<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { WatchConfig } from '../../core/config/types';
  import type { WatchDetails } from '../../core/config/details';
  import type { RowDef } from '../../core/catalog/types';
  import { i18n } from '../i18n.svelte';
  import ChoiceCarousel from '../kit/ChoiceCarousel.svelte';
  import ScaleSettings from './ScaleSettings.svelte';
  let {
    config,
    settingsRows,
    presets,
    surface,
    onprofile,
    onchange,
    oncommit,
  }: {
    config: WatchConfig;
    settingsRows: RowDef[];
    presets: { name: string; color: string }[];
    surface: Snippet;
    onprofile: (profile: string) => void;
    onchange: (style: string, details: WatchDetails) => void;
    oncommit: () => void;
  } = $props();
  const labels = $derived(
    i18n.locale === 'fr'
      ? {
          profile: 'Profil du réhaut',
          previous: 'Précédent',
          next: 'Suivant',
          material: 'Matière',
          scale: 'Graduations',
          hint: 'Le profil fin ne porte pas de graduations. Choisis un profil plus large ci-dessus pour les afficher ; tes réglages sont conservés.',
        }
      : {
          profile: 'Flange profile',
          previous: 'Previous',
          next: 'Next',
          material: 'Material',
          scale: 'Graduations',
          hint: 'The thin profile has no space for graduations. Choose a wider profile above to display them; your settings are kept.',
        },
  );
  const row = $derived(settingsRows.find((row) => row.id === 'rehaut')!);
  const paths: Record<string, string> = {
    classic: 'M-28 12H-7L0 7H28',
    sloped: 'M-28 12H-12L10-10H28',
    concave: 'M-28 12H-12Q10 12 10-10H28',
    stepped: 'M-28 12H-10V1H10V-10H28',
    flat: 'M-28 0H28',
  };
</script>

<div class="rehaut-settings">
  <ChoiceCarousel
    value={config.rehaut.profile}
    label={labels.profile}
    heading={labels.profile}
    previous={labels.previous}
    next={labels.next}
    options={row.variants.map((variant) => ({
      value: String(variant.value),
      label: variant.i18n.name,
    }))}
    onchange={onprofile}
  >
    {#snippet preview(profile: string)}
      <svg viewBox="-34 -20 68 42" aria-hidden="true">
        <path d={paths[profile] ?? paths.classic} />
      </svg>
    {/snippet}
  </ChoiceCarousel>
  <section class="rehaut-section" aria-label={labels.material}>
    <h3>{labels.material}</h3>
    {@render surface()}
  </section>
  <section class="rehaut-section" aria-label={labels.scale}>
    <h3>{labels.scale}</h3>
    {#if config.rehaut.profile === 'classic'}<p class="hint">{labels.hint}</p>{/if}
    <ScaleSettings target="rehautScale" {config} {settingsRows} {presets} {onchange} {oncommit} />
  </section>
</div>

<style>
  .rehaut-settings {
    display: grid;
    gap: 18px;
    min-width: 0;
  }
  .rehaut-section {
    display: grid;
    gap: 16px;
    min-width: 0;
    padding-top: 18px;
    border-top: 1px solid var(--control-line);
  }
  h3 {
    margin: 0;
    font-size: var(--text-m);
    font-weight: 600;
  }
  .hint {
    margin: 0;
    line-height: 1.5;
    color: var(--ink-soft);
    font-size: var(--text-s);
  }
  svg {
    width: 56px;
    height: 48px;
    overflow: visible;
  }
  path {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
</style>
