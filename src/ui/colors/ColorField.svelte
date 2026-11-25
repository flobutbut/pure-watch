<script lang="ts" module>
  /** Le mode qui ouvre le sélecteur de couleur ; les autres suivent une couleur de la montre. */
  export const CUSTOM = 'custom';
</script>

<script lang="ts" generics="T extends string">
  /**
   * Réglage de couleur du design system (documentation/design-system.md), le même partout :
   * 1. un libellé ;
   * 2. une commande segmentée des modes (« Automatique », « Encre du cadran »… puis
   *    « Couleur libre ») ;
   * 3. en couleur libre seulement : les couleurs de la montre à reprendre, puis `ColorPicker`.
   * Sans `modes`, le réglage se réduit au sélecteur (couleur toujours libre).
   */
  import { normalizeHex } from '../../core/config/colors';
  import type { HexColor } from '../../core/config/types';
  import { t } from '../i18n.svelte';
  import Button from '../kit/Button.svelte';
  import SegmentedControl from '../kit/SegmentedControl.svelte';
  import ColorPicker from './ColorPicker.svelte';
  let {
    label,
    value,
    presets,
    modes,
    mode,
    onmode,
    matches = [],
    onchange,
    oncommit,
  }: {
    /** Libellé visible ; omis quand le titre du panneau nomme déjà la couleur. */
    label?: string;
    /** Couleur montrée dans le sélecteur. */
    value: string;
    presets: { name: string; color: string }[];
    /** Modes proposés ; celui qui vaut `CUSTOM` ouvre le sélecteur. */
    modes?: readonly { value: T; label: string }[];
    mode?: T;
    onmode?: (mode: T) => void;
    /** Couleurs d'autres éléments de la montre, reprises d'un geste en couleur libre. */
    matches?: readonly { label: string; color: string }[];
    onchange: (value: HexColor) => void;
    oncommit?: () => void;
  } = $props();
  const custom = $derived(!modes || mode === CUSTOM);
  const name = $derived(label ?? t().colors.color);
</script>

<section class="color-field" aria-label={name}>
  {#if label}<p class="section-label">{label}</p>{/if}
  {#if modes && mode !== undefined && onmode}
    <SegmentedControl label={name} value={mode} options={modes} onchange={onmode} />
  {/if}
  {#if custom}
    {#if matches.length}
      <div class="matches" role="group" aria-label={t().colors.reuseFrom}>
        {#each matches as match (match.label)}
          <Button size="compact" onclick={() => onchange(normalizeHex(match.color)!)}>
            <span class="dot" style:--swatch={match.color}></span>{match.label}
          </Button>
        {/each}
      </div>
    {/if}
    <ColorPicker {value} {presets} {onchange} {oncommit} />
  {/if}
</section>

<style>
  .color-field {
    display: grid;
    gap: 12px;
    min-width: 0;
  }
  .color-field .section-label {
    margin: 0;
  }
  .matches {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }
</style>
