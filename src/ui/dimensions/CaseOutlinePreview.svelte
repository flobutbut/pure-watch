<script lang="ts">
  import type { WatchConfig } from '../../core/config/types';
  import { watchDimensions } from '../../core/geometry/dimensions';
  import { shapeRadius } from '../../core/geometry/case-shape';
  import { caseOutline } from '../../render3d/parts/case-envelope';
  import { caseLevels } from '../../render3d/parts/levels';
  import { strapPocket } from '../../render3d/parts/lugs';
  import { i18n } from '../i18n.svelte';
  let { config }: { config: WatchConfig } = $props();
  const fr = $derived(i18n.locale === 'fr');
  /** One quarter seen from above, framed on the 12 o'clock lug and its root. */
  const drawing = $derived.by(() => {
    const d = watchDimensions(config);
    const { R } = caseLevels(d);
    let outline: { x: number; y: number }[];
    try {
      outline = caseOutline(config, d);
    } catch {
      return null;
    }
    const bottom = R * 0.5;
    const top = Math.max(...outline.map((p) => p.y)) + 0.6;
    const left = -1.2;
    const right = Math.max(...outline.filter((p) => p.y > bottom).map((p) => p.x)) + 0.8;
    const scale = 300 / (right - left);
    const x = (v: number) => 10 + (v - left) * scale;
    const y = (v: number) => 10 + (top - v) * scale;
    const path = (points: { x: number; y: number }[]) =>
      `M${points.map((p) => `${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(' L')} Z`;
    const body = Array.from({ length: 180 }, (_, i) => {
      const angle = (i / 180) * Math.PI * 2,
        r = R * shapeRadius(config.case.shape, angle);
      return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
    });
    // The strap pocket is carved from below: drawn dashed, as a hidden edge.
    const pocket = strapPocket(config, d);
    const pocketPath = pocket
      ? `M${x(pocket.halfWidth).toFixed(1)},${y(pocket.edge + 1).toFixed(1)} L${x(pocket.halfWidth).toFixed(1)},${y(pocket.back).toFixed(1)} L${x(-pocket.halfWidth).toFixed(1)},${y(pocket.back).toFixed(1)}`
      : null;
    return {
      height: (top - bottom) * scale + 10,
      centre: x(0),
      pocket: pocketPath,
      outline: path(outline),
      body: path(body),
    };
  });
</script>

{#if drawing}
  <figure>
    <svg
      viewBox="0 0 320 {drawing.height.toFixed(1)}"
      role="img"
      aria-label={fr
        ? 'Contour du boîtier et des attaches vu de dessus'
        : 'Case and attachments outline seen from above'}
    >
      <path class="outline" d={drawing.outline} />
      <line class="axis" x1={drawing.centre} y1="0" x2={drawing.centre} y2={drawing.height} />
      <path class="body" d={drawing.body} />
      {#if drawing.pocket}<path class="pocket" d={drawing.pocket} />{/if}
    </svg>
    <figcaption>
      {#if drawing.pocket}
        {fr
          ? 'Vue de dessus, 12 h · tirets : poche du bracelet, creusée par-dessous'
          : 'Top view, 12 o’clock · dashes: strap pocket, carved from below'}
      {:else}
        {fr
          ? 'Vue de dessus, corne de 12 h · pointillés : carrure seule'
          : 'Top view, 12 o’clock lug · dotted: case body alone'}
      {/if}
    </figcaption>
  </figure>
{/if}

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
    max-height: 180px;
  }
  .outline {
    stroke: var(--ink);
    stroke-width: 1.5;
    stroke-linejoin: round;
    fill: color-mix(in srgb, var(--ink) 10%, transparent);
  }
  .axis {
    stroke: var(--ink-soft);
    stroke-width: 1;
    stroke-dasharray: 1 5;
  }
  .pocket {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.2;
    stroke-dasharray: 6 4;
  }
  .body {
    fill: none;
    stroke: var(--ink-soft);
    stroke-width: 1;
    stroke-dasharray: 3 4;
  }
  figcaption {
    color: var(--ink-soft);
    font-size: var(--text-s);
    text-align: center;
    line-height: 1.5;
    margin-top: 6px;
  }
</style>
