<script lang="ts">
  /**
   * Banc de rendu studio, avec le design system (documentation/design-system.md).
   * Le rendu studio occupe toute la scène ; le rendu en temps réel du configurateur s'y pose en
   * miniature, au même cadrage. Les réglages tiennent dans un panneau latéral fixe, aux tons
   * des panneaux du site (suivant le cadran) : modes en SegmentedControl, fonds en boutons à
   * pastille, export en bouton primary.
   */
  import { onDestroy, onMount } from 'svelte';
  import type { WatchConfig } from '../../core/config/types';
  import type { Refinement } from '../../render3d/refinement';
  import { ambienceFor, NIGHT_AMBIENCE } from '../../ui/ambience';
  import Button from '../../ui/kit/Button.svelte';
  import SegmentedControl from '../../ui/kit/SegmentedControl.svelte';
  import {
    StudioBench,
    VIEWFINDER_MARGIN,
    type Lighting,
    type StudioStatus,
    type StudioView,
  } from './engine';

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
  let rasterMs = $state<number | null>(null);
  let status = $state<StudioStatus>({
    phase: 'building',
    pending: false,
    samples: 0,
    target: 384,
    elapsedMs: 0,
    progress: 0,
  });
  let exportState = $state<'idle' | 'busy' | 'saved' | 'failed'>('idle');
  let savedName = $state('');
  /** Taille de la scène : la miniature en reprend les proportions, donc le cadrage. */
  let stageWidth = $state(1);
  let stageHeight = $state(1);

  /** Marge du viseur autour du cadre du rendu, en part de la miniature (chaque côté). */
  const frameInset = `${((1 - 1 / VIEWFINDER_MARGIN) / 2) * 100}%`;

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
      case 'exporting': {
        const [width, height] = status.exportSize ?? [0, 0];
        return `Export ${width} × ${height} px · ${status.samples} / ${status.target} · ${seconds(status.elapsedMs)}`;
      }
      case 'paused':
        return `En pause · ${status.samples} / ${status.target} échantillons · ${seconds(status.elapsedMs)}`;
      case 'done':
        return `${status.target} échantillons en ${seconds(status.elapsedMs)}`;
      default:
        return `${status.samples} / ${status.target} échantillons · ${seconds(status.elapsedMs)}`;
    }
  });

  // Les tons du panneau suivent le cadran, comme les panneaux du configurateur
  // (:root[data-tone]).
  $effect(() => {
    const root = document.documentElement;
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

  function renderViewfinder() {
    bench?.renderViewfinder();
    view = null;
  }

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

<div class="bench">
  <main class="stage" bind:clientWidth={stageWidth} bind:clientHeight={stageHeight}>
    <canvas
      class="studio"
      bind:this={tracedCanvas}
      style:background={backdropColor}
      aria-label="Montre en lancer de rayons"
    ></canvas>

    <figure class="thumbnail">
      <div class="viewport" style:aspect-ratio="{stageWidth} / {stageHeight}">
        <canvas
          bind:this={rasterCanvas}
          style:background={backdropColor}
          aria-label="Viseur en temps réel : glisser pour tourner, molette pour zoomer, clic droit pour déplacer"
        ></canvas>
        <!-- Champ exact du rendu studio : le viseur voit plus large autour. -->
        <div class="frame" style:inset={frameInset} aria-hidden="true"></div>
      </div>
      <figcaption class="viewfinder-bar">
        <span class="caption">
          {status.pending ? 'Nouveau cadrage' : 'Temps réel'}{rasterMs === null || status.pending
            ? ''
            : ` · ${decimal(rasterMs)} ms`}
        </span>
        {#if status.pending}
          <Button variant="primary" size="compact" disabled={!ready} onclick={renderViewfinder}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" /></svg>
            Rendre cette vue
          </Button>
        {:else if status.phase === 'rendering'}
          <Button size="compact" onclick={() => bench?.pause()}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4.5 3h2.4v10H4.5zM9.1 3h2.4v10H9.1z" />
            </svg>
            Pause
          </Button>
        {:else if status.phase === 'paused'}
          <Button size="compact" onclick={() => bench?.resume()}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" /></svg>
            Reprendre
          </Button>
        {/if}
      </figcaption>
    </figure>

    <div class="chip progress-chip" role="status">
      <span>{statusText}</span>
      <span
        class="progress"
        class:finished={status.phase === 'done'}
        style:--progress={status.progress}
        aria-hidden="true"
      ></span>
    </div>
  </main>

  <aside class="panel" aria-labelledby="studio-title">
    <header>
      <div class="title-row">
        <div>
          <p class="eyebrow">BANC DE RENDU</p>
          <h1 id="studio-title">Rendu studio</h1>
        </div>
        <a class="close" href={configLink} aria-label="Fermer et revenir au configurateur">×</a>
      </div>
      <p class="lede">
        Lancer de rayons, affiné image après image. En miniature, le temps réel du configurateur, au
        même cadrage.
      </p>
    </header>

    <div class="body">
      <section>
        <p class="section-label">Vue</p>
        <SegmentedControl
          label="Vue"
          value={(view ?? '') as StudioView}
          options={VIEWS}
          onchange={(next) => bench?.setView(next)}
        />
        <p class="hint">
          Cadrer dans la miniature : glisser pour tourner, molette ou pincement pour zoomer, clic
          droit ou Maj + glisser pour déplacer. Le cadre blanc montre le champ du rendu studio, qui
          garde son point de vue jusqu’à « Rendre cette vue ».
        </p>
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
        <p class="hint">Le plus grand côté de l’image ; l’autre suit le cadrage de la scène.</p>
      </section>
    </div>

    <footer>
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
    </footer>
  </aside>
</div>

<style>
  /* Tons fixes des panneaux du site (Sheet), clair ou sombre selon le cadran : ils servent au
     panneau latéral comme aux pastilles posées sur la scène, quel que soit le fond choisi. */
  .bench {
    --ink: #20242b;
    --veil: #faf9f6;
    --ink-soft: color-mix(in srgb, var(--ink) 66%, var(--veil));
    --panel-width: 360px;
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--panel-width);
    background: var(--veil);
    color: var(--ink);
  }
  :global(:root[data-tone='dark']) .bench {
    --ink: #f4f3ef;
    --veil: #25282c;
  }

  .stage {
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .studio {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: grab;
  }
  canvas:active {
    cursor: grabbing;
  }

  /* Pastilles posées sur la scène : voile du panneau, lisibles sur tous les fonds. */
  .chip {
    margin: 0;
    padding: 6px 12px;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--veil) 86%, transparent);
    backdrop-filter: blur(10px);
    color: var(--ink);
    font-size: var(--text-s);
    font-variant-numeric: tabular-nums;
    line-height: 1.3;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ink) 10%, transparent);
  }

  .thumbnail {
    position: absolute;
    left: 20px;
    bottom: 20px;
    width: clamp(210px, 24%, 300px);
    margin: 0;
    border-radius: var(--radius-m);
    overflow: hidden;
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--ink) 14%, transparent),
      0 12px 40px #0004;
  }
  .viewport {
    position: relative;
    overflow: hidden;
  }
  .viewport canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: grab;
  }
  /* Cadre du rendu studio : un trait clair bordé de sombre, lisible sur tous les fonds, et
     l'extérieur du cadre légèrement voilé. */
  .frame {
    position: absolute;
    border: 1px solid #fffd;
    box-shadow:
      0 0 0 1px #0007,
      0 0 0 999px #0003;
    pointer-events: none;
  }

  /* Barre du viseur, sous la miniature : ce qu'elle montre et l'action du rendu. */
  .viewfinder-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 6px 8px;
    padding: 6px 6px 6px 12px;
    background: var(--veil);
    color: var(--ink);
  }
  .caption {
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .viewfinder-bar :global(.button) {
    min-height: 30px;
    padding: 5px 10px;
  }
  .viewfinder-bar svg {
    width: 11px;
    height: 11px;
    fill: currentColor;
  }

  .progress-chip {
    position: absolute;
    right: 20px;
    bottom: 20px;
    display: grid;
    gap: 6px;
    max-width: calc(100% - 40px);
  }
  /* Avancement du calcul : un trait à l'encre, effacé une fois l'image finie. */
  .progress {
    position: relative;
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

  /* Panneau latéral : en-tête, corps défilant, pied, comme Sheet, mais posé à côté de la scène. */
  .panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-left: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
    background: var(--veil);
  }
  header {
    flex-shrink: 0;
    padding: 24px 24px 20px;
  }
  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 8px;
  }
  /* Même croix que les panneaux du site (Sheet) : ici, elle ramène au configurateur. */
  .close {
    display: grid;
    place-items: center;
    min-width: 36px;
    min-height: var(--control-height);
    margin: -6px -8px 0 0;
    border-radius: var(--radius-s);
    color: inherit;
    font-size: 26px;
    font-weight: 300;
    line-height: 1;
    text-decoration: none;
  }
  .close:hover {
    background: color-mix(in srgb, currentColor 8%, transparent);
  }
  .close:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 3px;
  }
  .eyebrow {
    margin: 0 0 4px;
    font-size: var(--text-2xs);
    letter-spacing: 0.16em;
    color: var(--ink-soft);
  }
  h1 {
    margin: 0;
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
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: grid;
    align-content: start;
    gap: 20px;
    padding: 4px 24px 8px;
    scrollbar-width: thin;
  }
  section {
    min-width: 0;
  }
  footer {
    flex-shrink: 0;
    display: grid;
    gap: 10px;
    padding: 20px 24px 24px;
    border-top: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  }

  /* Vocabulaire commun des panneaux (Sheet) : libellés, pastilles, anneau de focus. */
  .panel :global(.section-label) {
    margin: 0 0 8px;
    font-size: var(--text-s);
    color: var(--ink-soft);
  }
  .panel :global(.dot) {
    flex-shrink: 0;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--swatch);
    box-shadow: inset 0 0 0 1px #8885;
  }
  .panel :global(button:focus-visible) {
    outline: 2px solid var(--ink);
    outline-offset: 3px;
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
  .status {
    margin: 0;
    font-size: var(--text-s);
    color: var(--ink-soft);
    overflow-wrap: anywhere;
  }
  .status:empty {
    display: none;
  }

  /* Sous 760 px : la scène en haut, le panneau dessous, la page défile. */
  @media (max-width: 759px) {
    .bench {
      display: block;
      overflow-y: auto;
    }
    .stage {
      height: 62dvh;
    }
    .panel {
      border-left: 0;
      border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
    }
    .body {
      overflow: visible;
    }
    .thumbnail {
      left: 12px;
      bottom: 12px;
      width: 46%;
    }
    .progress-chip {
      right: 12px;
      top: 12px;
      bottom: auto;
      max-width: calc(100% - 24px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .progress {
      transition: none;
    }
  }
</style>
