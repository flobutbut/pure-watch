<script lang="ts">
  import type { RowDef } from '../../core/catalog/types';
  import type { WatchConfig } from '../../core/config/types';
  import { compatibleMovements, mm, type Fit } from '../../core/movement/compatibility';
  import { movementStepsPerSecond, type MovementSpec } from '../../core/movement/movements';
  import Sheet from '../sheet/Sheet.svelte';
  import { identitySections } from './identity';

  interface Props {
    rows: readonly RowDef[];
    config: WatchConfig;
    onclose: () => void;
  }
  let { rows, config, onclose }: Props = $props();

  const sections = $derived(identitySections(rows, config));
  const movements = $derived(compatibleMovements(config));
  const FIT_LABEL: Record<Fit, string> = {
    ok: 'Compatible',
    adapt: 'Avec adaptations',
    check: 'À vérifier',
    no: 'Incompatible',
  };
  const CALENDAR: Record<MovementSpec['calendar'], string | null> = {
    none: 'Sans date',
    date: 'Date',
    'day-date': 'Jour et date',
    unknown: null,
  };
  /** Narrow no-break space as thousands separator, as in printed specification sheets. */
  const number = (value: number) => value.toLocaleString('fr-FR').replace(/\s/g, '\u202f');

  function details(movement: MovementSpec): string {
    if (movement.kind === 'quartz') return 'Pile · 1 pas par seconde';
    const parts = ['Automatique'];
    if (movement.frequencyVph) parts.push(`${number(movement.frequencyVph)} alt/h`);
    if (movement.powerReserveH) parts.push(`${movement.powerReserveH} h de réserve`);
    const calendar = CALENDAR[movement.calendar];
    if (calendar) parts.push(calendar);
    if (movement.diameterMm && movement.heightMm)
      parts.push(`Ø ${number(movement.diameterMm)} × ${mm(movement.heightMm, 2)}`);
    return parts.join(' · ');
  }
  const TABS = [
    { id: 'traits', label: 'Caractéristiques' },
    { id: 'movements', label: 'Mouvements' },
  ] as const;
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
    return `Trotteuse de la vue 3D : ${steps} pas par seconde`;
  }
</script>

<Sheet
  id="identity-title"
  eyebrow="FICHE D’IDENTITÉ"
  title="Votre montre"
  closeLabel="Masquer la fiche d’identité"
  placement="stage"
  {onclose}
>
  {#snippet toolbar()}
    <div class="tabs" role="tablist" aria-label="Contenu de la fiche">
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
          {item.label}
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
              </div>
            {/each}
          </dl>
        </section>
      {/each}
    {:else}
      <ul class="movements" aria-label="Mouvements compatibles">
        {#each movements as { movement, fit, notes } (movement.id)}
          <li class={fit}>
            <p class="name">
              {movement.name} <span class="fit">{FIT_LABEL[fit]}</span>
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
    justify-content: space-between;
    align-items: baseline;
    gap: 16px;
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
