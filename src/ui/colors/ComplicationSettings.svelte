<script lang="ts">
  import { subdialStyle, type SubdialStyle } from '../../core/config/subdial-style';
  import type { WatchDetails } from '../../core/config/details';
  import type { RowDef } from '../../core/catalog/types';
  import type { WatchConfig } from '../../core/config/types';
  import { getAtPath, setAtPath } from '../../core/config/path';
  import { smallSeconds } from '../../core/config/small-seconds';
  import { powerReserve } from '../../core/config/power-reserve';
  import { chronograph } from '../../core/config/chronograph';
  import { dateComplication } from '../../core/config/date';
  import SegmentedControl from '../kit/SegmentedControl.svelte';
  import { i18n, t } from '../i18n.svelte';
  let {
    target,
    config,
    settingsRows,
    onchange,
    ondetails,
  }: {
    target: 'reserve' | 'subdials' | 'date';
    config: WatchConfig;
    settingsRows: RowDef[];
    /** La configuration modifiée : complications, ou verre pour la loupe de date. */
    onchange: (value: WatchConfig) => void;
    ondetails: (value: WatchDetails) => void;
  } = $props();
  const ids = $derived(
    target === 'date'
      ? ['date-window', 'date-disc', 'date-loupe']
      : target === 'reserve'
        ? ['power-reserve-style']
        : smallSeconds(config)
          ? []
          : ['chronograph-counters'],
  );
  const rows = $derived(ids.flatMap((id) => settingsRows.filter((row) => row.id === id)));
  const styles = $derived(
    target === 'date' ? undefined : settingsRows.find((row) => row.id === 'small-seconds-style'),
  );
  const section = $derived(target === 'reserve' ? 'reserve' : 'subdials');
  /** La valeur portée par la montre, valeurs par défaut comprises. */
  const EFFECTIVE: Record<string, (config: WatchConfig) => unknown> = {
    'power-reserve-style': (config) => powerReserve(config)?.style,
    'chronograph-counters': (config) => chronograph(config)?.counters,
    'date-window': (config) => dateComplication(config)?.window,
    'date-disc': (config) => dateComplication(config)?.disc,
  };
  const valueOf = (row: RowDef) =>
    String(EFFECTIVE[row.id]?.(config) ?? getAtPath(config, row.path));
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

{#each rows as row (row.id)}
  <section aria-label={row.i18n.name}>
    <p class="section-label">{row.i18n.name}</p>
    <SegmentedControl
      label={row.i18n.name}
      value={valueOf(row)}
      options={row.variants.map((v) => ({ value: String(v.value), label: v.i18n.name }))}
      onchange={(value) =>
        // La commande rend du texte : on écrit la valeur de la variante (booléen de la loupe).
        onchange(
          setAtPath(
            config,
            row.path,
            row.variants.find((v) => String(v.value) === value)?.value ?? value,
          ),
        )}
    />
  </section>
{/each}

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
