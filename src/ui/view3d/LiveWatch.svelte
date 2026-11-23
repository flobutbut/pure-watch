<script lang="ts">
  import { untrack } from 'svelte';
  import type { WatchConfig } from '../../core/config/types';
  import type { LiveWatch, PartRenderer } from '../../render/types';
  import { bootStage } from '../boot';

  interface Props {
    renderer: PartRenderer | null;
    config: WatchConfig;
    transient?: boolean;
    mode: 'grid' | 'inspect';
    /** Poignée exposée au parent (vues prédéfinies, rotation, pause). */
    handle?: LiveWatch | null;
  }

  let { renderer, config, transient = false, mode, handle = $bindable(null) }: Props = $props();
  let container: HTMLDivElement;
  let live = $state.raw<LiveWatch | null>(null);
  $effect(() => {
    handle = live;
  });

  // Montage une seule fois par moteur de rendu ; configuration et mode suivent à part.
  $effect(() => {
    if (!renderer) return;
    const instance = renderer.mountWatch(
      container,
      untrack(() => config),
    );
    live = instance;
    instance.ready.then(
      () => bootStage('watch'),
      () => {},
    );
    return () => {
      instance.destroy();
      live = null;
    };
  });

  $effect(() => {
    const next = config;
    const preview = transient;
    untrack(() => live?.update(next, preview));
  });

  $effect(() => {
    live?.setMode(mode);
  });
</script>

<div class="live" bind:this={container}></div>

<style>
  .live {
    width: 100%;
    height: 100%;
  }
</style>
