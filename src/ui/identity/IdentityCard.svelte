<script lang="ts">
  import type { RowDef } from '../../core/catalog/types';
  import type { WatchConfig } from '../../core/config/types';
  import { compatibleMovements, mm, type Fit } from '../../core/movement/compatibility';
  import { movementStepsPerSecond, type MovementSpec } from '../../core/movement/movements';
  import Sheet from '../sheet/Sheet.svelte';
  import { identitySections } from './identity';
  import { NUMBER_LOCALE } from '../../core/i18n/locale';
  import { i18n, t } from '../i18n.svelte';

  interface Props {
    rows: readonly RowDef[];
    config: WatchConfig;
    onclose: () => void;
  }
  let { rows, config, onclose }: Props = $props();

  const sections = $derived(identitySections(rows, config, i18n.locale));
  const movements = $derived(compatibleMovements(config, i18n.locale));
  const fitLabel = (fit: Fit) => t().movement[fit];
  const calendarLabel = (calendar: MovementSpec['calendar']): string | null =>
    calendar === 'none'
      ? t().movement.noDate
      : calendar === 'date'
        ? t().movement.date
        : calendar === 'day-date'
          ? t().movement.dayDate
          : null;
  /** Narrow no-break space as thousands separator, as in printed specification sheets. */
  const number = (value: number) =>
    value.toLocaleString(NUMBER_LOCALE[i18n.locale]).replace(/\s/g, '\u202f');

  function details(movement: MovementSpec): string {
    const m = t().movement;
    if (movement.kind === 'quartz') return m.battery;
    const parts = [m.automatic];
    if (movement.frequencyVph) parts.push(m.frequency(number(movement.frequencyVph)));
    if (movement.powerReserveH) parts.push(m.reserve(movement.powerReserveH));
    const calendar = calendarLabel(movement.calendar);
    if (calendar) parts.push(calendar);
    if (movement.diameterMm && movement.heightMm)
      parts.push(`Ø ${number(movement.diameterMm)} × ${mm(movement.heightMm, 2, i18n.locale)}`);
    return parts.join(' · ');
  }
  const TABS = [{ id: 'traits' }, { id: 'movements' }] as const;
  type Tab = (typeof TABS)[number]['id'];
  let tab = $state<Tab>('traits');
  let panels: HTMLDivElement;
  function choose(next: Tab, focus = false) {
    tab = next;
    // Each tab starts at its top, whatever was scrolled in the other.
    panels.closest('.body')?.scrollTo({ top: 0 });
    if (focus) document.getElementById(`identity-tab-${next}`)?.focus();
  }
  function tabKey(event: KeyboardEvent) {
    const index = TABS.findIndex((t) => t.id === tab);
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowLeft'
        ? (index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? TABS.length - 1
            : -1;
    if (next < 0) return;
    event.preventDefault();
    choose(TABS[next]!.id, true);
  }
  function cadence(movement: MovementSpec): string {
    const steps = movementStepsPerSecond(movement.id);
    return t().movement.cadence(steps);
  }
</script>

<Sheet
  id="identity-title"
  eyebrow={t().identity.eyebrow}
  title={t().identity.title}
  closeLabel={t().identity.close}
  placement="stage"
  {onclose}
>
  {#snippet toolbar()}
    <div class="tabs" role="tablist" aria-label={t().identity.tabs}>
      {#each TABS as item (item.id)}
        <button
          type="button"
          role="tab"
          id="identity-tab-{item.id}"
          aria-selected={tab === item.id}
          aria-controls="identity-panel"
          tabindex={tab === item.id ? 0 : -1}
          class:chosen={tab === item.id}
          onclick={() => choose(item.id)}
          onkeydown={tabKey}
        >
          {t().identity[item.id]}
        </button>
      {/each}
    </div>
  {/snippet}
  <div id="identity-panel" role="tabpanel" aria-labelledby="identity-tab-{tab}" bind:this={panels}>
    {#if tab === 'traits'}
      {#each sections as section (section.title)}
        <section>
          <h3 class="section-label">{section.title}</h3>
          <dl>
            {#each section.traits as trait (trait.label)}
              <div>
                <dt>{trait.label}</dt>
                <dd>
                  {#if trait.swatch}<span
                      class="dot"
                      class:metal={trait.metal}
                      style:--swatch={trait.swatch}
                    ></span>{/if}{trait.value}
                </dd>
                {#if trait.reference}<p class="ref">{trait.reference}</p>{/if}
              </div>
            {/each}
          </dl>
        </section>
      {/each}
    {:else}
      <ul class="movements" aria-label={t().identity.movementsLabel}>
        {#each movements as { movement, fit, notes } (movement.id)}
          <li class={fit}>
            <p class="name">
              {movement.name} <span class="fit">{fitLabel(fit)}</span>
            </p>
            <p class="meta">{details(movement)}</p>
            {#if notes.length}
              <ul class="notes">
                {#each notes as note (note)}<li>{note}</li>{/each}
              </ul>
            {/if}
            {#if movement.id === config.movement}<p class="cadence">{cadence(movement)}</p>{/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</Sheet>

<style>
  section + section {
    margin-top: 20px;
  }
  h3 {
    font-weight: inherit;
  }
  dl {
    margin: 0;
  }
  dl div {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: baseline;
    gap: 2px 16px;
    padding: 7px 0;
    border-bottom: 1px solid color-mix(in srgb, var(--ink) 9%, transparent);
    font-size: 12px;
  }
  dl div:last-child {
    border-bottom: 0;
  }
  dt {
    opacity: 0.6;
  }
  .ref {
    flex-basis: 100%;
    margin: 0;
    text-align: right;
    font-size: 11px;
    opacity: 0.55;
  }
  dd {
    margin: 0;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    text-align: right;
  }
  dd .dot {
    align-self: center;
  }
  .tabs {
    display: flex;
    gap: 4px;
    padding: 3px;
    border: 1px solid var(--control-line);
    border-radius: 12px;
    background: var(--control);
  }
  .tabs button {
    flex: 1;
    min-height: 36px;
    border: 1px solid transparent;
    border-radius: 9px;
    background: transparent;
    font-size: 12px;
  }
  .tabs button:focus-visible {
    outline-offset: -1px;
  }
  .tabs .chosen {
    border-color: var(--ink);
    background: color-mix(in srgb, var(--ink) 12%, transparent);
  }
  .movements {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  /* Ghost rows: no frame, a single rule between movements, as in the traits list. */
  .movements > li {
    padding: 14px 0;
    border-bottom: 1px solid color-mix(in srgb, var(--ink) 9%, transparent);
    font-size: 12px;
  }
  .movements > li:first-child {
    padding-top: 2px;
  }
  .movements > li:last-child {
    border-bottom: 0;
  }
  .fit {
    margin-left: 4px;
    font-size: 11px;
    font-weight: 400;
    opacity: 0.6;
  }
  .ok .fit {
    opacity: 1;
  }
  .name {
    margin: 0;
    font-weight: 500;
  }
  .no .name,
  .no .meta {
    opacity: 0.55;
  }
  .meta {
    margin: 6px 0 0;
    opacity: 0.6;
    line-height: 1.5;
  }
  .notes {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    line-height: 1.5;
  }
  .notes li + li {
    margin-top: 2px;
  }
  .cadence {
    margin: 8px 0 0;
    font-size: 11px;
    opacity: 0.6;
  }
</style>
