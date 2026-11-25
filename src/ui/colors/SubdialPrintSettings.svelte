<script lang="ts">
  import type { WatchConfig, HexColor } from '../../core/config/types';
  import type { WatchDetails } from '../../core/config/details';
  import { subdialInk } from '../../core/config/subdials';
  import { powerReserve } from '../../core/config/power-reserve';
  import { normalizeHex } from '../../core/config/colors';
  import ColorField, { CUSTOM } from './ColorField.svelte';
  import { DETAIL_SETTINGS } from './detail-settings';
  import { i18n, t } from '../i18n.svelte';

  let {
    config,
    value,
    reserve = false,
    presets,
    onchange,
    oncommit,
  }: {
    config: WatchConfig;
    value: WatchDetails;
    reserve?: boolean;
    presets: { name: string; color: string }[];
    onchange: (value: WatchDetails) => void;
    oncommit: () => void;
  } = $props();
  const m = $derived(DETAIL_SETTINGS[i18n.locale]);
  const section = $derived(reserve ? 'reserve' : 'subdials');
  const ink = $derived(value[section]?.ink ?? 'auto');
  const scale = $derived(powerReserve(config)?.style);
  function patch(data: { ink?: HexColor | 'auto'; lowColor?: HexColor | 'auto'; label?: string }) {
    onchange({ ...value, [section]: { ...value[section], ...data } });
  }
</script>

{#snippet autoColor(
  label: string,
  value: string,
  fallback: string,
  set: (value: HexColor | 'auto') => void,
)}
  <ColorField
    {label}
    {presets}
    {oncommit}
    modes={[
      { value: 'auto', label: m.auto },
      { value: CUSTOM, label: t().colors.custom },
    ]}
    mode={value === 'auto' ? 'auto' : CUSTOM}
    onmode={(mode) => set(mode === 'auto' ? 'auto' : normalizeHex(fallback)!)}
    value={value === 'auto' ? fallback : value}
    onchange={set}
  />
{/snippet}

<section aria-label={m.miniPrint}>
  <h3>{m.miniPrint}</h3>
  {@render autoColor(reserve ? m.reserveInk : m.miniInk, ink, subdialInk(config, reserve), (ink) =>
    patch({ ink }),
  )}
  {#if reserve && (scale === 'segments' || scale === 'fuel')}
    {@render autoColor(m.low, value.reserve?.lowColor ?? 'auto', '#D2352B', (lowColor) =>
      patch({ lowColor }),
    )}
  {/if}
  {#if reserve && scale === 'arc'}
    <label>
      {m.label}<input
        type="text"
        aria-label={m.label}
        maxlength="24"
        value={value.reserve?.label ?? 'RÉSERVE'}
        oninput={(event) => patch({ label: event.currentTarget.value })}
      />
    </label>
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
  label {
    display: grid;
    gap: 8px;
    font-size: var(--text-s);
  }
  input {
    width: 100%;
    min-width: 0;
    padding: 9px 10px;
    box-sizing: border-box;
    border: 1px solid var(--control-line);
    border-radius: 6px;
    background: var(--surface, transparent);
    color: var(--ink);
    font: inherit;
  }
</style>
