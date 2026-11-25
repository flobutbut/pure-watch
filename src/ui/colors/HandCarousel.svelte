<script lang="ts">
  import { HAND_STYLES } from '../../core/config/hands';
  import { HAND_GLYPHS } from './hand-glyphs';
  import { PART_SETTINGS } from './part-settings';
  import { i18n } from '../i18n.svelte';
  import ChoiceCarousel from '../kit/ChoiceCarousel.svelte';
  let {
    value,
    baseStyle,
    label,
    onchange,
  }: { value: string; baseStyle: string; label: string; onchange: (style: string) => void } =
    $props();
  const m = $derived(PART_SETTINGS[i18n.locale]);
  const options = $derived(
    ['match', ...HAND_STYLES].map((style) => ({
      value: style,
      label: style === 'match' ? m.match : (m.styles[style] ?? style),
    })),
  );
</script>

<ChoiceCarousel
  {value}
  {label}
  {options}
  heading={m.design}
  previous={m.previous}
  next={m.next}
  {onchange}
>
  {#snippet preview(style: string)}
    <svg viewBox="-10 -70 20 82" aria-hidden="true">
      <path
        d={HAND_GLYPHS[style === 'match' ? baseStyle : style] ?? HAND_GLYPHS.sword}
        fill-rule="evenodd"
      />
      <circle cx="0" cy="0" r="2.1" />
    </svg>
  {/snippet}
</ChoiceCarousel>

<style>
  svg {
    height: 48px;
    width: 28px;
    fill: currentColor;
  }
</style>
