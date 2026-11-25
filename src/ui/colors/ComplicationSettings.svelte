<script lang="ts">
  import { subdialStyle, type SubdialStyle } from '../../core/config/subdial-style';
  import type { WatchDetails } from '../../core/config/details';
  import type { RowDef } from '../../core/catalog/types';
  import type { WatchConfig } from '../../core/config/types';
  import { getAtPath, setAtPath } from '../../core/config/path';
  import { smallSeconds } from '../../core/config/small-seconds';
  import { powerReserve } from '../../core/config/power-reserve';
  import { chronograph } from '../../core/config/chronograph';
  import SegmentedControl from '../kit/SegmentedControl.svelte';
  import { i18n, t } from '../i18n.svelte';
  let {
    target,
    config,
    settingsRows,
    onchange,
    ondetails,
  }: {
    target: 'reserve' | 'subdials';
    config: WatchConfig;
    settingsRows: RowDef[];
    onchange: (value: WatchConfig['complications']) => void;
    ondetails: (value: WatchDetails) => void;
  } = $props();
  const id = $derived(
    target === 'reserve'
      ? 'power-reserve-style'
      : smallSeconds(config)
        ? null
        : 'chronograph-counters',
  );
  const row = $derived(settingsRows.find((row) => row.id === id));
  const styles = $derived(settingsRows.find((row) => row.id === 'small-seconds-style'));
  const section = $derived(target === 'reserve' ? 'reserve' : 'subdials');
  const value = $derived(
    String(
      (id === 'power-reserve-style'
        ? powerReserve(config)?.style
        : chronograph(config)?.counters) ?? getAtPath(config, row?.path ?? ''),
    ),
  );
</script>

{#if styles}
  <section aria-label={t().colors.subdialRelief}>
    <p class="section-label">{t().colors.subdialRelief}</p>
    <SegmentedControl
      label={t().colors.subdialRelief}
      value={subdialStyle(config, section)}
      options={styles.variants
        .filter((v) => v.value === 'flat' || v.value === 'sunken')
        .map((v) => ({ value: String(v.value), label: v.i18n.name }))}
      onchange={(value) =>
        ondetails({
          ...config.details,
          [section]: { ...config.details?.[section], subdialStyle: value as SubdialStyle },
        })}
    />
    <p class="style-hint">
      {i18n.locale === 'fr'
        ? 'Plat : au niveau du cadran. En creux : un fond abaissé dans une cuvette. La finition se choisit en dessous.'
        : 'Flat: level with the main dial. Recessed: a lowered surface inside a bowl. Choose the surface finish below.'}
    </p>
  </section>
{/if}

{#if row}
  <section aria-label={row.i18n.name}>
    <p class="section-label">{row.i18n.name}</p>
    <SegmentedControl
      label={row.i18n.name}
      {value}
      options={row.variants.map((v) => ({ value: String(v.value), label: v.i18n.name }))}
      onchange={(value) => onchange(setAtPath(config, row!.path, value).complications)}
    />
  </section>
{/if}

<style>
  section {
    margin-bottom: 22px;
  }
  .style-hint {
    margin: 10px 0 0;
    font-size: var(--text-s);
    color: var(--ink-soft);
    line-height: 1.5;
  }
</style>
