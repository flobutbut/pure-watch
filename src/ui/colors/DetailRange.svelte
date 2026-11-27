<script lang="ts">
  import RangeField from '../kit/RangeField.svelte';
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

<RangeField {label} {value} {min} {max} {step} {onchange} compact />
