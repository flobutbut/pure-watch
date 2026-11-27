<script lang="ts">
  let {
    label,
    ariaLabel = label,
    value,
    min,
    max,
    step = 0.01,
    display = `${Math.round(value * 100)} %`,
    hint = '',
    compact = false,
    onchange,
  }: {
    label: string;
    ariaLabel?: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    display?: string;
    hint?: string;
    compact?: boolean;
    onchange: (value: number) => void;
  } = $props();
  const hintId = $props.id();
</script>

<label class="range-field" class:compact>
  <span>{label}</span><output>{display}</output>
  <input
    type="range"
    aria-label={ariaLabel}
    aria-valuetext={display}
    aria-describedby={hint ? hintId : undefined}
    {min}
    {max}
    {step}
    {value}
    oninput={(event) => onchange(Number(event.currentTarget.value))}
  />
  {#if hint}<span class="hint" id={hintId}>{hint}</span>{/if}
</label>

<style>
  .range-field {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    font-size: var(--text-m);
    min-width: 0;
  }
  .compact {
    font-size: var(--text-s);
  }
  output,
  .hint {
    color: var(--ink-soft);
    font-size: var(--text-s);
  }
  input {
    grid-column: 1/-1;
    width: 100%;
    box-sizing: border-box;
    margin: 2px 0;
    accent-color: var(--ink);
  }
  .hint {
    grid-column: 1/-1;
    line-height: 1.5;
  }
</style>
