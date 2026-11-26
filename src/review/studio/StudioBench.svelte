<script lang="ts">
  /**
   * Banc de rendu studio, avec le design system (documentation/design-system.md) : fond
   * d'ambiance déduit du cadran, réglages dans un panneau Sheet, modes en SegmentedControl,
   * fonds en boutons à pastille, export en bouton primary.
   */
  import { onDestroy, onMount } from 'svelte';
  import type { WatchConfig } from '../../core/config/types';
  import type { Refinement } from '../../render3d/refinement';
  import Ambience from '../../ui/Ambience.svelte';
  import { ambienceFor, NIGHT_AMBIENCE } from '../../ui/ambience';
  import Button from '../../ui/kit/Button.svelte';
  import SegmentedControl from '../../ui/kit/SegmentedControl.svelte';
  import Sheet from '../../ui/sheet/Sheet.svelte';
  import { StudioBench, type Lighting, type StudioStatus, type StudioView } from './engine';

  interface Props {
    config: WatchConfig;
    refinement: Refinement;
    /** Lien de cette montre dans le configurateur. */
    configLink: string;
    textureSize?: number;
    keyScale?: number;
  }
  let { config, refinement, configLink, textureSize, keyScale }: Props = $props();

  const ambience = $derived(config.view.night ? NIGHT_AMBIENCE : ambienceFor(config.dial));

  const BACKDROPS = $derived([
    { value: 'ambience', label: 'Ambiance', color: ambience.base },
    { value: 'slate', label: 'Ardoise', color: '#1B1F27' },
    { value: 'paper', label: 'Papier', color: '#E5E5E3' },
    { value: 'linen', label: 'Lin', color: '#B9A58C' },
  ]);
  const VIEWS: { value: StudioView; label: string }[] = [
    { value: 'front', label: 'Face' },
    { value: 'quarter', label: 'Trois quarts' },
    { value: 'grazing', label: 'Rasant' },
  ];
  const LIGHTINGS: { value: Lighting; label: string }[] = [
    { value: 'photo', label: 'Photo produit' },
    { value: 'configurator', label: 'Configurateur' },
  ];
  const FINENESS = [
    { value: '128', label: 'Rapide' },
    { value: '384', label: 'Net' },
    { value: '1024', label: 'Sans grain' },
  ] as const;
  type Fineness = (typeof FINENESS)[number]['value'];
  const SIZES = [
    { value: '1024', label: '1024 px' },
    { value: '2048', label: '2048 px' },
    { value: '4096', label: '4096 px' },
  ] as const;
  type Size = (typeof SIZES)[number]['value'];

  let rasterCanvas: HTMLCanvasElement;
  let tracedCanvas: HTMLCanvasElement;
  let bench: StudioBench | null = null;

  let view = $state<StudioView | null>('quarter');
  let lighting = $state<Lighting>('photo');
  let backdrop = $state('ambience');
  let fineness = $state<Fineness>('384');
  let size = $state<Size>('2048');
  let panelOpen = $state(true);
  let rasterMs = $state<number | null>(null);
  let status = $state<StudioStatus>({
    phase: 'building',
    samples: 0,
    target: 384,
    elapsedMs: 0,
    progress: 0,
  });
  let exportState = $state<'idle' | 'busy' | 'saved' | 'failed'>('idle');
  let savedName = $state('');

  const backdropColor = $derived(BACKDROPS.find((b) => b.value === backdrop)!.color);
  const ready = $derived(status.phase !== 'building' && status.phase !== 'preparing');

  const decimal = (value: number, digits = 1) =>
    value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const seconds = (ms: number) => `${decimal(ms / 1000)} s`;

  const statusText = $derived.by(() => {
    switch (status.phase) {
      case 'building':
        return 'Construction des montres…';
      case 'preparing':
        return `Préparation du lancer de rayons · ${Math.round(status.progress * 100)} %`;
      case 'exporting':
        return `Export ${status.exportSize} px · ${status.samples} / ${status.target} échantillons · ${seconds(status.elapsedMs)}`;
      case 'done':
        return `${status.target} échantillons en ${seconds(status.elapsedMs)}`;
      default:
        return `${status.samples} / ${status.target} échantillons · ${seconds(status.elapsedMs)}`;
    }
  });

  // L'interface prend le ton du cadran, comme le configurateur : le panneau suit
  // :root[data-tone] pour ses deux tons fixes.
  $effect(() => {
    const root = document.documentElement;
    root.style.backgroundColor = ambience.base;
    root.style.colorScheme = ambience.tone;
    root.dataset.tone = ambience.tone;
  });

  onMount(() => {
    bench = new StudioBench({
      raster: rasterCanvas,
      traced: tracedCanvas,
      config,
      refinement,
      backdrop: backdropColor,
      lighting,
      target: Number(fineness),
      textureSize,
      keyScale,
      onstatus: (next) => (status = next),
      onraster: (ms) => (rasterMs = ms),
      onview: (next) => (view = next),
    });
    window.__studio = bench;
    void bench.start('quarter');
  });
  onDestroy(() => bench?.dispose());

  function chooseBackdrop(value: string) {
    backdrop = value;
    bench?.setBackdrop(backdropColor);
  }

  async function exportImage() {
    if (!bench || exportState === 'busy') return;
    exportState = 'busy';
    try {
      const blob = await bench.exportPng(Number(size));
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = savedName = `epure-studio-${size}px-${fineness}spp.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      exportState = 'saved';
    } catch {
      exportState = 'failed';
    }
  }
</script>

<Ambience {ambience} />

<div
  class="bench"
  style:--ink={ambience.ink}
  style:--ink-soft={ambience.inkSoft}
  style:--ink-faint={ambience.inkFaint}
  style:--veil={ambience.veil}
  class:panel-open={panelOpen}
>
  <header class="intro">
    <p class="eyebrow">BANC DE RENDU</p>
    <h1>Rendu studio</h1>
    <p class="lede">
      La même montre, la même caméra et le même studio. À gauche, le temps réel du configurateur ; à
      droite, le lancer de rayons, qui s’affine image après image.
    </p>
  </header>

  <main class="views">
    <figure>
      <canvas bind:this={rasterCanvas} aria-label="Montre en temps réel"></canvas>
      <figcaption>
        <span class="name">Temps réel</span>
        <span class="meta">{rasterMs === null ? '…' : `Une image · ${decimal(rasterMs)} ms`}</span>
      </figcaption>
    </figure>
    <figure>
      <canvas bind:this={tracedCanvas} aria-label="Montre en lancer de rayons"></canvas>
      <div
        class="progress"
        class:finished={status.phase === 'done'}
        style:--progress={status.progress}
        aria-hidden="true"
      ></div>
      <figcaption>
        <span class="name">Studio · lancer de rayons</span>
        <span class="meta">{statusText}</span>
      </figcaption>
    </figure>
  </main>

  {#if !panelOpen}
    <div class="reopen">
      <Button onclick={() => (panelOpen = true)}>Réglages</Button>
    </div>
  {/if}
</div>

{#if panelOpen}
  <Sheet
    id="studio-settings"
    eyebrow="RENDU STUDIO"
    title="Réglages"
    closeLabel="Fermer les réglages"
    onclose={() => (panelOpen = false)}
  >
    <div class="settings">
      <section>
        <p class="section-label">Vue</p>
        <SegmentedControl
          label="Vue"
          value={(view ?? '') as StudioView}
          options={VIEWS}
          onchange={(next) => bench?.setView(next)}
        />
        <p class="hint">Glisser sur une montre fait tourner les deux.</p>
      </section>

      <section>
        <p class="section-label">Éclairage</p>
        <SegmentedControl
          label="Éclairage"
          value={lighting}
          options={LIGHTINGS}
          onchange={(next) => {
            lighting = next;
            bench?.setLighting(next);
          }}
        />
      </section>

      <section>
        <p class="section-label" id="backdrop-label">Fond</p>
        <div class="choices" role="group" aria-labelledby="backdrop-label">
          {#each BACKDROPS as option (option.value)}
            <Button
              size="compact"
              aria-pressed={backdrop === option.value}
              onclick={() => chooseBackdrop(option.value)}
            >
              <span class="dot" style:--swatch={option.color}></span>
              {option.label}
            </Button>
          {/each}
        </div>
      </section>

      <section>
        <p class="section-label">Finesse</p>
        <SegmentedControl
          label="Finesse"
          value={fineness}
          options={FINENESS}
          onchange={(next) => {
            fineness = next;
            bench?.setTarget(Number(next));
          }}
        />
        <p class="hint">128, 384 ou 1 024 échantillons par pixel, à l’écran comme à l’export.</p>
      </section>

      <section>
        <p class="section-label">Définition de l’export</p>
        <SegmentedControl
          label="Définition de l’export"
          value={size}
          options={SIZES}
          onchange={(next) => (size = next)}
        />
      </section>
    </div>

    {#snippet footer()}
      <div class="export">
        <Button
          variant="primary"
          disabled={!ready}
          aria-busy={exportState === 'busy'}
          onclick={exportImage}
        >
          {exportState === 'busy' ? 'Export en cours…' : 'Exporter le rendu studio'}
        </Button>
        <p class="status" role="status">
          {#if exportState === 'saved'}
            Image enregistrée : {savedName}
          {:else if exportState === 'failed'}
            L’export a échoué. Réessayer avec une définition plus petite.
          {/if}
        </p>
        <a class="link" href={configLink}>Ouvrir cette montre dans le configurateur</a>
      </div>
    {/snippet}
  </Sheet>
{/if}

<style>
  /* Sous le panneau des réglages (340 px à 24 px du bord), les deux vues gardent leur place. */
  .bench {
    --panel-room: 388px;
    position: fixed;
    inset: 0;
    overflow-y: auto;
    padding: 32px 32px 40px;
    color: var(--ink);
  }
  .bench.panel-open {
    padding-right: var(--panel-room);
  }
  .intro {
    max-width: 64ch;
    margin-bottom: 24px;
  }
  .eyebrow {
    margin: 0 0 6px;
    font-size: var(--text-2xs);
    letter-spacing: 0.16em;
    color: var(--ink-soft);
  }
  h1 {
    margin: 0 0 8px;
    font-size: var(--text-title);
    font-weight: 500;
    line-height: 1.2;
  }
  .lede {
    margin: 0;
    font-size: var(--text-m);
    line-height: 1.5;
    color: var(--ink-soft);
  }
  .views {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    /* Les deux carrés tiennent dans la fenêtre sous l'en-tête. */
    max-width: calc((100dvh - 200px) * 2 + 16px);
  }
  figure {
    position: relative;
    margin: 0;
    min-width: 0;
  }
  canvas {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--radius-l);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ink) 12%, transparent);
    touch-action: none;
    cursor: grab;
  }
  canvas:active {
    cursor: grabbing;
  }
  figcaption {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 4px 12px;
    padding: 10px 4px 0;
    font-size: var(--text-s);
  }
  .meta {
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
  }
  /* Avancement du calcul, posé sur le bas de l'image : un trait à l'encre, effacé une fois fini. */
  .progress {
    position: relative;
    margin: -12px 18px 10px;
    height: 2px;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--ink) 18%, transparent);
    overflow: hidden;
    transition: opacity 400ms;
  }
  .progress::after {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--ink);
    transform-origin: left;
    transform: scaleX(var(--progress));
  }
  .progress.finished {
    opacity: 0;
  }
  .reopen {
    position: fixed;
    top: 24px;
    right: 24px;
  }

  .settings {
    display: grid;
    gap: 20px;
  }
  section {
    min-width: 0;
  }
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }
  .hint {
    margin: 8px 0 0;
    font-size: var(--text-xs);
    line-height: 1.4;
    color: var(--ink-soft);
  }
  .export {
    display: grid;
    gap: 10px;
    width: 100%;
  }
  .status {
    min-height: 1.4em;
    margin: 0;
    font-size: var(--text-s);
    color: var(--ink-soft);
    overflow-wrap: anywhere;
  }
  .status:empty {
    display: none;
  }
  .link {
    font-size: var(--text-s);
    color: var(--ink-soft);
    text-underline-offset: 3px;
  }
  .link:hover {
    color: var(--ink);
  }
  .link:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 3px;
    border-radius: var(--radius-xs);
  }

  /* Sous 760 px, le panneau devient une feuille en bas d'écran : les vues s'empilent. */
  @media (max-width: 759px) {
    .bench,
    .bench.panel-open {
      padding: 20px 16px 40px;
    }
    .bench.panel-open {
      padding-bottom: calc(60dvh + 24px);
    }
    .views {
      grid-template-columns: minmax(0, 1fr);
      max-width: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .progress {
      transition: none;
    }
  }
</style>
