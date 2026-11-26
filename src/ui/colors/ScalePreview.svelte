<script lang="ts">
  let { value, rehaut = false }: { value: string; rehaut?: boolean } = $props();
  const tachy = [500, 400, 300, 250, 200, 180, 160, 140, 120, 110, 100, 90, 80, 75, 70, 65, 60];
  const marks = $derived(
    value === 'tachymeter'
      ? tachy.map((v) => 3600 / v)
      : Array.from({ length: value === '24h' ? 24 : 60 }, (_, i) =>
          value === '24h' ? i * 2.5 : i,
        ),
  );
  const numbers = $derived(
    value === '24h'
      ? [24, 6, 12, 18]
      : value === 'tachymeter'
        ? [500, 200, 100, 60]
        : [60, 15, 30, 45],
  );
</script>

<svg viewBox="-50 -50 100 100" aria-hidden="true">
  {#if rehaut}<circle r="43" class="edge" /><circle r="30" class="edge" />{/if}
  {#if value === 'none'}
    <circle r="35" class="empty" /><path d="M-24 24 24-24" class="empty" />
  {:else}
    {#if value === 'railroad'}<circle r="43" class="rail" /><circle r="36" class="rail" />{/if}
    {#each marks as minute (minute)}
      {#if value === 'dots'}
        <circle
          cx={40 * Math.sin((minute * Math.PI) / 30)}
          cy={-40 * Math.cos((minute * Math.PI) / 30)}
          r={minute % 5 === 0 ? 2 : 0.8}
        />
      {:else if rehaut || value !== 'five-minute' || minute % 5 === 0}
        <line
          x1="0"
          y1="-43"
          x2="0"
          y2={value === 'railroad' || minute % 5 === 0 ? -36 : -39}
          transform={`rotate(${minute * 6})`}
          stroke-width={minute % 5 === 0 ? 1.8 : 0.8}
        />
      {/if}
    {/each}
    {#if rehaut && ['five-minute', '24h', 'tachymeter'].includes(value)}
      {#each numbers as number, i (number)}
        {@const minute = value === 'tachymeter' ? 3600 / number : i * 15}
        <text
          x={33 * Math.sin((minute * Math.PI) / 30)}
          y={-33 * Math.cos((minute * Math.PI) / 30)}
        >
          {number}
        </text>
      {/each}
    {/if}
  {/if}
</svg>

<style>
  svg {
    width: 56px;
    height: 48px;
    fill: currentColor;
  }
  line,
  .rail,
  .edge,
  .empty {
    fill: none;
    stroke: currentColor;
  }
  .rail {
    stroke-width: 1;
  }
  .edge {
    opacity: 0.25;
    stroke-width: 0.7;
  }
  .empty {
    opacity: 0.35;
    stroke-width: 1.4;
  }
  text {
    font:
      7px Arial,
      sans-serif;
    text-anchor: middle;
    dominant-baseline: central;
  }
</style>
