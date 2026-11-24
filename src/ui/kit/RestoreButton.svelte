<script lang="ts">
  /** « ↺ Rétablir », au pied des panneaux de réglage. */
  import Button from './Button.svelte';
  import { t } from '../i18n.svelte';

  let { disabled, title, onclick }: { disabled: boolean; title?: string; onclick: () => void } =
    $props();
</script>

<Button {disabled} {title} {onclick}>
  <span class="glyph" aria-hidden="true">↺</span>
  {t().colors.restore}
</Button>

<style>
  .glyph {
    font-size: 15px;
    line-height: 1;
  }
</style>
