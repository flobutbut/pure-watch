<script lang="ts">
  import { fontFaceCss, fontDef } from '../../render2d/fonts';
  let {
    kind,
    value,
    roman = false,
  }: { kind: 'font' | 'index'; value: string; roman?: boolean } = $props();
  let fontCss = $state('');
  const font = $derived(fontDef(value));
  $effect(() => {
    if (kind !== 'font') return;
    let active = true;
    fontFaceCss(value).then((text) => {
      if (active) fontCss = text;
    });
    return () => {
      active = false;
    };
  });
  const paths: Record<string, string> = {
    baton: 'M-3-23H3V23H-3Z',
    'baton-facet': 'M0-24 4-20 4 20 0 24-4 20-4-20Z M0-24V24',
    dauphine: 'M-5-22H5L2 16 0 25-2 16Z M0-22V25',
    triangles: 'M-8-22H8L0 23Z',
    baguettes: 'M-2-25H2V25H-2Z',
    drops: 'M0-24C14-4 10 18 0 23C-10 18-14-4 0-24Z',
  };
</script>

<svg viewBox="-27 -30 54 60" aria-hidden="true">
  {#if kind === 'font'}
    <svelte:element this={'style'}>{fontCss}</svelte:element>
    <text
      x="0"
      y="2"
      text-anchor="middle"
      dominant-baseline="central"
      font-family={font.family}
      font-weight={font.weight}
      font-style={font.style ?? 'normal'}
      font-size={roman ? 23 : 31}
    >
      {roman ? 'XII' : '12'}
    </text>
  {:else if value === 'dots'}
    <circle r="7" />
  {:else if value === 'dive' || value === 'mixed-batons'}
    <g transform="translate(-12 0)">
      <path d={value === 'dive' ? paths.triangles : paths.baton} transform="scale(.6)" />
    </g>
    <circle cx="12" r="6" />
  {:else if value === 'none'}
    <circle r="11" fill="none" stroke="currentColor" opacity=".35" /><path
      d="M-8 8 8-8"
      fill="none"
      stroke="currentColor"
    />
  {:else}
    <path d={paths[value] ?? paths.baton} stroke="currentColor" stroke-width=".6" />
  {/if}
</svg>

<style>
  svg {
    width: 54px;
    height: 48px;
    fill: currentColor;
  }
</style>
