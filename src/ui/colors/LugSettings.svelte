<script lang="ts">
  import { LUG_JOINS, type LugJoin } from '../../core/config/lugs';
  import Button from '../kit/Button.svelte';
  import { i18n } from '../i18n.svelte';
  import { LUG_SETTINGS } from './lug-settings';
  let { value, onchange }: { value: LugJoin; onchange: (value: LugJoin) => void } = $props();
  const m = $derived(LUG_SETTINGS[i18n.locale]);
</script>

<p class="intro">{m.intro}</p>
<h3>{m.label}</h3>
<div class="joins" role="group" aria-label={m.label}>
  {#each LUG_JOINS as join (join)}
    <Button variant="quiet" aria-pressed={value === join} onclick={() => onchange(join)}>
      <span>{m.names[join]}</span>
    </Button>
  {/each}
</div>
<p class="description">{m.descriptions[value]}</p>
<p class="note">{m.note}</p>

<style>
  .intro,
  .note,
  .description {
    font-size: var(--text-m);
    line-height: 1.5;
    color: var(--ink-soft);
  }
  .intro {
    margin: 0 0 24px;
  }
  h3 {
    font-size: var(--text-m);
    font-weight: 600;
    margin: 0 0 12px;
  }
  .joins {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 3px;
    padding: 4px;
    border: 1px solid var(--control-line);
    border-radius: var(--radius-m);
    background: var(--control);
  }
  .description {
    margin: 12px 0 6px;
    min-height: 3em;
  }
  .note {
    margin: 24px 0 0;
    padding-top: 20px;
    border-top: 1px solid var(--control-line);
    font-size: var(--text-s);
  }
</style>
