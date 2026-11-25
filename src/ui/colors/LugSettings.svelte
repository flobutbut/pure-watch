<script lang="ts">
  import { LUG_JOINS, type LugJoin } from '../../core/config/lugs';
  import SegmentedControl from '../kit/SegmentedControl.svelte';
  import { i18n } from '../i18n.svelte';
  import { LUG_SETTINGS } from './lug-settings';
  let { value, onchange }: { value: LugJoin; onchange: (value: LugJoin) => void } = $props();
  const m = $derived(LUG_SETTINGS[i18n.locale]);
</script>

<p class="intro">{m.intro}</p>
<h3>{m.label}</h3>
<SegmentedControl
  label={m.label}
  {value}
  options={LUG_JOINS.map((join) => ({ value: join, label: m.names[join] }))}
  {onchange}
/>
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
