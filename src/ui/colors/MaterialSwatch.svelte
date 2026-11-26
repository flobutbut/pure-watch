<script lang="ts">
  /**
   * Pastille d'une matière : la teinte et l'effet d'un coup d'œil (reflet du vernis et du
   * poli, stries du brossé, halo du luminescent). Même taille que les pastilles de couleur.
   */
  let {
    kind,
    effect,
    color,
    glow,
  }: {
    kind: 'ink' | 'metal' | 'lume';
    effect?: string;
    color: string;
    /** Couleur de nuit d'un pigment luminescent. */
    glow?: string;
  } = $props();
</script>

<span
  class="material-swatch {kind} {effect ?? ''}"
  style:--swatch={color}
  style:--glow={glow ?? color}
  aria-hidden="true"
></span>

<style>
  .material-swatch {
    flex-shrink: 0;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: var(--swatch);
    box-shadow: inset 0 0 0 1px #8885;
  }
  .ink.varnished {
    background: radial-gradient(circle at 32% 28%, #fffc 0 12%, #fff0 42%), var(--swatch);
  }
  .metal.polished {
    background: linear-gradient(135deg, #fffb, #fff0 42%, #0005 70%, #fff6), var(--swatch);
  }
  .metal.brushed {
    background:
      repeating-linear-gradient(90deg, #fff0 0 1px, #fff5 1px 2px),
      linear-gradient(135deg, #fff6, #fff0 50%, #0003), var(--swatch);
  }
  .lume {
    background: linear-gradient(135deg, var(--swatch) 50%, var(--glow) 50%);
    box-shadow:
      inset 0 0 0 1px #8885,
      0 0 5px color-mix(in srgb, var(--glow) 70%, transparent);
  }
</style>
