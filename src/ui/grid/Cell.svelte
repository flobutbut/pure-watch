<script lang="ts">
  import type { PartRenderer, PartRequest } from '../../render/types';
  import { onDestroy, untrack } from 'svelte';
  import { bootCellReady, bootExpectCell, booting } from '../boot';
  import { snapshotCache } from './snapshot-cache';

  interface Props {
    renderer: PartRenderer | null;
    request: PartRequest;
  }

  let { renderer, request }: Props = $props();
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

  function paint(canvas: HTMLCanvasElement, source: ImageBitmap | null) {
    const draw = (b: ImageBitmap | null) => {
      if (!b) return;
      canvas.width = b.width;
      canvas.height = b.height;
      canvas.getContext('2d')?.drawImage(b, 0, 0);
    };
    draw(source);
    return { update: draw };
  }
</script>

<canvas use:paint={bitmap} class:loaded={bitmap !== null}></canvas>
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
