<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { Ambience } from './ambience';

  let { ambience }: { ambience: Ambience } = $props();
</script>

<!-- Fond de l'interface : prolonge le cadran choisi. Fondu enchaîné à chaque changement. -->
<div class="ambience" aria-hidden="true">
  {#key ambience.key}
    <div class="layer" transition:fade={{ duration: 600 }} style:background-color={ambience.base}>
      <div class="glow" class:drift={ambience.drift} style:background-image={ambience.layers}></div>
    </div>
  {/key}
</div>

<style>
  .ambience,
  .layer {
    position: fixed;
    inset: 0;
    overflow: hidden;
  }

  .glow {
    position: absolute;
    inset: -15%;
  }

  /* Effets changeants (iridescence) : dérive lente, uniquement par transform. */
  .glow.drift {
    animation: drift 38s ease-in-out infinite alternate;
  }

  @keyframes drift {
    from {
      transform: translate3d(-3%, -2%, 0) rotate(-4deg) scale(1);
    }
    to {
      transform: translate3d(3%, 2%, 0) rotate(5deg) scale(1.06);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .glow.drift {
      animation: none;
    }
  }
</style>
