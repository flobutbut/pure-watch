<script lang="ts">
  let {
    label,
    value,
    min,
    max,
    step = 0.01,
    onchange,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onchange: (value: number) => void;
  } = $props();
</script>

<label class="detail-range">
  <span>{label}</span><output>{Math.round(value * 100)} %</output>
  <input
    type="range"
    aria-label={label}
    {min}
    {max}
    {step}
    {value}
    oninput={(e) => onchange(Number(e.currentTarget.value))}
  />
</label>

<style>
  .detail-range {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    font-size: var(--text-s);
  }
  output {
    color: var(--ink-soft);
  }
  input {
    grid-column: 1/-1;
    width: 100%;
    margin: 2px 0;
    accent-color: var(--ink);
  }
</style>
