<script lang="ts">
  import type { WatchConfig, HexColor } from '../../core/config/types';
  import type { WatchDetails } from '../../core/config/details';
  import {
    SUBDIAL_HAND_STYLES,
    subdialHand,
    type SubdialHandStyle,
  } from '../../core/config/subdial-hand';
  import { handColor } from '../../core/config/colors';
  import ChoiceCarousel from '../kit/ChoiceCarousel.svelte';
  import ColorField, { CUSTOM } from './ColorField.svelte';
  import { PART_SETTINGS } from './part-settings';
  import { DETAIL_SETTINGS } from './detail-settings';
  import { SUBDIAL_HAND_LABELS } from './subdial-hand-labels';
  import { i18n, t } from '../i18n.svelte';
  let {
    config,
    reserve = false,
    value,
    presets,
    onchange,
    oncommit,
  }: {
    config: WatchConfig;
    reserve?: boolean;
    value: WatchDetails;
    presets: { name: string; color: string }[];
    onchange: (value: WatchDetails) => void;
    oncommit: () => void;
  } = $props();
  const m = $derived(SUBDIAL_HAND_LABELS[i18n.locale]);
  const title = $derived(
    reserve ? (i18n.locale === 'fr' ? 'Aiguille de réserve' : 'Power reserve hand') : m.title,
  );
  const hand = $derived(subdialHand({ ...config, details: value }, reserve));
  const options = $derived(
    SUBDIAL_HAND_STYLES.map((style) => ({ value: style, label: m.styles[style] })),
  );
  function patch(patch: { style?: SubdialHandStyle; color?: HexColor | 'match' }) {
    onchange(
      reserve
        ? {
            ...value,
            reserve: {
              ...value.reserve,
              ...(patch.style ? { handStyle: patch.style } : {}),
              ...(patch.color ? { handColor: patch.color === 'match' ? 'auto' : patch.color } : {}),
            },
          }
        : {
            ...value,
            subdials: { ...value.subdials, hand: { ...value.subdials?.hand, ...patch } },
          },
    );
  }
  const glyphs: Record<string, string> = {
    thin: 'M-.7 12V-60H.7V12Z',
    counterweight: 'M-.7 16V-60H.7V16ZM0 7a4 4 0 1 0 0 8a4 4 0 1 0 0-8',
    lollipop:
      'M-.7 16V-60H.7V16ZM0-55a5 5 0 1 0 0 10a5 5 0 1 0 0-10ZM0-53a3 3 0 1 1 0 6a3 3 0 1 1 0-6',
    arrow: 'M-.7 12V-46H-4L0-62L4-46H.7V12Z',
    triangle: 'M-.7 12V-43H-4L0-62L4-43H.7V12Z',
    baton: 'M-1.5 12V-60H1.5V12Z',
    diamond: 'M-.7 12V-43L-4-51L0-62L4-51L.7-43V12Z',
    teardrop: 'M-.7 8V-60H.7V8C5 16-5 16-.7 8Z',
    'ring-tail':
      'M-.7 7V-60H.7V7ZM0 5a5 5 0 1 0 0 10a5 5 0 1 0 0-10ZM0 7a3 3 0 1 1 0 6a3 3 0 1 1 0-6',
    lightning: 'M-1 12L-1-15L3-25L-2-37L1-60H2L0-37L5-25L1-14L1 12Z',
    none: 'M-7-25H7V-23H-7Z',
  };
</script>

<section aria-label={title}>
  <h3>{title}</h3>
  <ChoiceCarousel
    value={hand.style}
    label={m.design}
    heading={PART_SETTINGS[i18n.locale].design}
    {options}
    previous={PART_SETTINGS[i18n.locale].previous}
    next={PART_SETTINGS[i18n.locale].next}
    onchange={(style) => patch({ style: style as SubdialHandStyle })}
  >
    {#snippet preview(style: string)}
      <svg viewBox="-10 -70 20 92" aria-hidden="true">
        <path d={glyphs[style]} fill-rule="evenodd" />
      </svg>
    {/snippet}
  </ChoiceCarousel>
  {#if hand.style !== 'none'}
    <ColorField
      label={reserve ? DETAIL_SETTINGS[i18n.locale].hand : m.color}
      {presets}
      {oncommit}
      modes={[
        { value: 'match', label: t().colors.matchHands },
        { value: CUSTOM, label: t().colors.custom },
      ]}
      mode={hand.color === 'match' ? 'match' : CUSTOM}
      onmode={(mode) => patch({ color: mode === 'match' ? 'match' : handColor(config) })}
      value={hand.color === 'match' ? handColor(config) : hand.color}
      onchange={(color) => patch({ color })}
    />
  {/if}
</section>

<style>
  section {
    display: grid;
    gap: 17px;
    margin: 20px 0;
    border-top: 1px solid var(--control-line);
    padding-top: 18px;
    min-width: 0;
  }
  h3 {
    font-size: var(--text-m);
    margin: 0;
    font-weight: 600;
  }
  svg {
    width: 28px;
    height: 48px;
    fill: currentColor;
  }
</style>
