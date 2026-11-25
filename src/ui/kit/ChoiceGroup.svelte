<script lang="ts">
  import Button from './Button.svelte';
  let {
    label,
    value,
    options,
    columns,
    onchange,
  }: {
    label: string;
    value: string;
    options: readonly { value: string; label: string }[];
    columns?: number;
    onchange: (value: string) => void;
  } = $props();
</script>

<div class="choice-group">
  <p class="section-label">{label}</p>
  <div class="choices" class:columns style:--columns={columns} role="group" aria-label={label}>
    {#each options as option (option.value)}
      <Button aria-pressed={value === option.value} onclick={() => onchange(option.value)}>
        {option.label}
      </Button>
    {/each}
  </div>
</div>

<style>
  .choice-group {
    grid-column: 1 / -1;
    min-width: 0;
  }
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }
  .columns {
    display: grid;
    grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
  }
</style>
