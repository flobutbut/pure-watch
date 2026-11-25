<script lang="ts" generics="T extends string">
  /**
   * Commande segmentée du design system (documentation/design-system.md) : deux à quatre modes
   * exclusifs aux libellés courts, dans un même rail. Sémantique de boutons radio : une seule
   * tabulation pour le groupe, les flèches, Début et Fin changent le choix.
   */
  import { tick } from 'svelte';
  import Button from './Button.svelte';
  let {
    label,
    value,
    options,
    onchange,
  }: {
    /** Nom accessible du groupe ; un libellé visible se place au-dessus, à part. */
    label: string;
    value: T;
    options: readonly { value: T; label: string }[];
    onchange: (value: T) => void;
  } = $props();
  let rail: HTMLDivElement;
  const index = $derived(options.findIndex((option) => option.value === value));
  async function keydown(event: KeyboardEvent, i: number) {
    const last = options.length - 1;
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? (i + 1) % options.length
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? (i + last) % options.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : -1;
    if (next < 0) return;
    // The arrows otherwise browse the configurator rows behind the panel.
    event.preventDefault();
    event.stopPropagation();
    onchange(options[next]!.value);
    await tick();
    rail.querySelectorAll<HTMLButtonElement>('[role="radio"]').item(next)?.focus();
  }
</script>

<div
  class="segmented"
  style:--segments={options.length}
  role="radiogroup"
  aria-label={label}
  bind:this={rail}
>
  {#each options as option, i (option.value)}
    <Button
      variant="quiet"
      size="compact"
      role="radio"
      aria-checked={i === index ? 'true' : 'false'}
      chosen={i === index}
      tabindex={i === index || (index < 0 && i === 0) ? 0 : -1}
      onclick={() => onchange(option.value)}
      onkeydown={(event) => keydown(event, i)}
    >
      {option.label}
    </Button>
  {/each}
</div>

<style>
  .segmented {
    display: grid;
    grid-template-columns: repeat(var(--segments), minmax(0, 1fr));
    gap: 3px;
    padding: 3px;
    border: 1px solid color-mix(in srgb, currentColor 28%, transparent);
    border-radius: var(--radius-m);
    background: color-mix(in srgb, currentColor 5%, transparent);
  }
  .segmented :global(.button) {
    min-width: 0;
    text-align: center;
    overflow-wrap: anywhere;
  }
</style>
