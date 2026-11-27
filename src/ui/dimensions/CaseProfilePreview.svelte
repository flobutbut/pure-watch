<script lang="ts">
  import type { WatchConfig } from '../../core/config/types';
  import { watchDimensions } from '../../core/geometry/dimensions';
  import { lugLayout } from '../../render3d/parts/lugs';
  import { i18n } from '../i18n.svelte';
  let { config }: { config: WatchConfig } = $props();
  const fr = $derived(i18n.locale === 'fr');
  const d = $derived(watchDimensions(config));
  const guide = $derived(lugLayout(config, d, false));
  const drawing = $derived.by(() => {
    const scale = 280 / (guide.yTip * 2);
    const height = Math.max(
      100,
      (guide.root.top - Math.min(d.z.back, guide.profile(guide.yTip).bottom)) * scale + 34,
    );
    const x = (y: number) => 160 + y * scale;
    const z = (v: number) => 16 + (guide.root.top - v) * scale;
    const points = Array.from({ length: 121 }, (_, i) => {
      const y = -guide.yTip + (i / 120) * guide.yTip * 2;
      const section = guide.profile(Math.abs(y));
      return { x: x(y), top: z(section.top), bottom: z(section.bottom) };
    });
    const upper = points.map((p) => `${p.x.toFixed(2)},${p.top.toFixed(2)}`);
    const lower = [...points].reverse().map((p) => `${p.x.toFixed(2)},${p.bottom.toFixed(2)}`);
    // Where the case ends and where the descent begins, on both sides.
    const marks = [-1, 1].map((side) => ({
      edge: x(side * guide.R),
      start: x(side * guide.profileStart),
    }));
    return {
      height,
      top: z(guide.root.top) - 8,
      plane: z(d.z.back),
      marks,
      path: `M${upper.join(' L')} L${lower.join(' L')} Z`,
    };
  });
</script>

<figure>
  <svg
    viewBox="0 0 320 {drawing.height}"
    role="img"
    aria-label={fr
      ? 'Courbes du profil des cornes et plan du boîtier'
      : 'Lug profile curves and case-back plane'}
  >
    <line x1="8" y1={drawing.plane} x2="312" y2={drawing.plane} />
    {#each drawing.marks as mark (mark.edge)}
      <line class="edge" x1={mark.edge} y1={drawing.top} x2={mark.edge} y2={drawing.plane} />
      <circle cx={mark.start} cy={drawing.top + 8} r="2.5" />
    {/each}
    <path d={drawing.path} />
  </svg>
  <figcaption>
    {fr
      ? 'Vue de côté · pointillés : fond et bord du boîtier · point : début de la descente'
      : 'Side view · dotted: case back and edge · dot: start of the descent'}
  </figcaption>
</figure>

<style>
  figure {
    margin: 0;
    padding: 12px 8px;
    border: 1px solid var(--control-line);
    border-radius: var(--radius-s);
  }
  svg {
    display: block;
    width: 100%;
    overflow: visible;
  }
  line {
    stroke: var(--ink-soft);
    stroke-width: 1;
    stroke-dasharray: 3 4;
  }
  .edge {
    stroke-dasharray: 2 3;
  }
  circle {
    fill: var(--ink);
  }
  path {
    stroke: var(--ink);
    stroke-width: 1.5;
    stroke-linejoin: round;
    fill: color-mix(in srgb, var(--ink) 10%, transparent);
  }
  figcaption {
    color: var(--ink-soft);
    font-size: var(--text-s);
    text-align: center;
    line-height: 1.5;
    margin-top: 6px;
  }
</style>
