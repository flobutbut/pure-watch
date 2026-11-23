<script lang="ts">
  import type { PartRenderer, PartRequest } from '../../render/types';
  import { onDestroy, untrack } from 'svelte';
  import { bootCellReady, bootExpectCell, booting } from '../boot';
  import { snapshotCache } from './snapshot-cache';

  interface Props {
    renderer: PartRenderer | null;
    request: PartRequest;
    /** Côté affiché de la cellule en pixels physiques (calé par la grille). */
    displayPx?: number;
  }

  let { renderer, request, displayPx }: Props = $props();
  let bitmap = $state.raw<ImageBitmap | null>(null);

  // Vue de chargement : les pièces qui entourent la montre doivent être prêtes avant
  // qu'elle ne s'efface (anneau le plus proche du centre).
  // Seule la position au montage compte (untrack : lecture volontairement initiale).
  let awaited = booting() && untrack(() => request.priority ?? 0) <= 1.5;
  if (awaited) bootExpectCell();
  function settle() {
    if (!awaited) return;
    awaited = false;
    bootCellReady();
  }
  $effect(() => {
    if (bitmap) settle();
  });
  // Une pièce retirée avant d'être prête n'est plus attendue.
  onDestroy(settle);

  // L'instantané précédent reste affiché jusqu'à ce que le nouveau soit prêt :
  // pas de clignotement quand la configuration change.
  $effect(() => {
    if (!renderer) return;
    const key = renderer.cacheKey(request);
    const cached = snapshotCache.get(key);
    if (cached) {
      bitmap = cached;
      return;
    }
    const controller = new AbortController();
    renderer.renderPart(request, controller.signal).then(
      (image) => {
        if (image.kind !== 'bitmap') return;
        snapshotCache.set(key, image.bitmap);
        bitmap = image.bitmap;
      },
      () => {},
    );
    return () => controller.abort();
  });

  /**
   * L'instantané est rendu pour la cellule à pleine taille. Une cellule éloignée du centre
   * est réduite par une transformation CSS : on dessine l'image directement à la taille
   * affichée, en pixels physiques (lissage de haute qualité). La grille cale la cellule
   * sur les pixels de l'écran : l'image s'affiche pixel pour pixel, sans interpolation.
   */
  type PaintParams = { bitmap: ImageBitmap | null; px: number | undefined };
  function paint(canvas: HTMLCanvasElement, params: PaintParams) {
    const draw = ({ bitmap: b, px }: PaintParams) => {
      if (!b) return;
      const w = Math.max(1, px ?? b.width);
      const h = Math.max(1, px ?? b.height);
      if (canvas.width === w && canvas.height === h && drawn === b) return;
      drawn = b;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(b, 0, 0, w, h);
    };
    let drawn: ImageBitmap | null = null;
    draw(params);
    return { update: draw };
  }
</script>

<canvas use:paint={{ bitmap, px: displayPx }} class:loaded={bitmap !== null}></canvas>
{#if !bitmap}<span class="skeleton"></span>{/if}

<style>
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    transition: opacity 160ms var(--ease-out);
  }

  canvas.loaded {
    opacity: 1;
  }

  .skeleton {
    position: absolute;
    inset: 22%;
    border-radius: 50%;
    background: rgb(27 31 39 / 0.05);
  }
</style>
