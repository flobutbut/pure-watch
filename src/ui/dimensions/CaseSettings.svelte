<script lang="ts">
  import { isCasePreset, type CaseConstruction } from '../../core/config/case-construction';
  import type { WatchConfig } from '../../core/config/types';
  import CaseProfilePreview from './CaseProfilePreview.svelte';
  import CaseOutlinePreview from './CaseOutlinePreview.svelte';
  import RangeField from '../kit/RangeField.svelte';
  import ChoiceGroup from '../kit/ChoiceGroup.svelte';
  import Checkbox from '../kit/Checkbox.svelte';
  import { formatNumber } from '../../core/i18n/locale';
  import { i18n } from '../i18n.svelte';
  let {
    value,
    mode,
    config,
    guard,
    onchange,
    onguard,
    ondrawing,
  }: {
    value: CaseConstruction;
    mode: 'attachments' | 'profile' | 'finish';
    config: WatchConfig;
    guard: boolean;
    onchange: (value: CaseConstruction) => void;
    onguard: (value: boolean) => void;
    ondrawing: (drawing: string) => void;
  } = $props();
  const fr = $derived(i18n.locale === 'fr');
  /** Starting drawings for separate lugs; the solid block and "none" are attachment types. */
  const LUG_PRESETS = ['straight', 'pointed', 'teardrop'] as const;
  const presetNames = $derived(
    fr ? ['Classiques', 'Effilées', 'Gouttes'] : ['Classic', 'Tapered', 'Teardrop'],
  );
  const lugs = $derived(value.attachment === 'lugs');
  const attached = $derived(value.attachment !== 'none');
  const preset = $derived(
    lugs && isCasePreset(config) && (LUG_PRESETS as readonly string[]).includes(config.case.lugs)
      ? config.case.lugs
      : '',
  );
  function attachment(type: string) {
    if (type === value.attachment) return;
    if (type === 'block') ondrawing('integrated');
    else if (type === 'none') ondrawing('none');
    else
      ondrawing(
        (LUG_PRESETS as readonly string[]).includes(config.case.lugs)
          ? config.case.lugs
          : 'straight',
      );
  }
  const mm = (v: number) => `${formatNumber(Number(v.toFixed(2)), i18n.locale)} mm`;
  function patch(update: Partial<CaseConstruction>) {
    const next = { ...value, ...update };
    next.tipOffsetMm = Math.min(
      next.tipOffsetMm,
      Math.max(0, config.case.thicknessMm * 0.85 - next.tipThicknessMm),
    );
    onchange(next);
  }
  type Field = {
    key:
      | 'integration'
      | 'lugWidthMm'
      | 'taper'
      | 'swell'
      | 'tipRound'
      | 'sectionRound'
      | 'transition'
      | 'dome'
      | 'tipThicknessMm'
      | 'tipOffsetMm'
      | 'edgeSizeMm';
    label: string;
    min?: number;
    max?: number;
    step?: number;
    metric?: boolean;
    hint?: string;
  };
</script>

{#snippet range(field: Field)}
  <RangeField
    label={field.label}
    min={field.min ?? 0}
    max={field.max ?? 1}
    step={field.step ?? 0.01}
    value={value[field.key]}
    display={field.metric ? mm(value[field.key]) : `${Math.round(value[field.key] * 100)} %`}
    hint={field.hint}
    onchange={(n) => patch({ [field.key]: n })}
  />
{/snippet}

<div class="case-settings">
  {#if mode === 'attachments'}
    <p class="intro">
      {fr
        ? 'Les attaches vues de dessus : cornes, raccord et protections de couronne.'
        : 'Attachments seen from above: lugs, root blend and crown guards.'}
    </p>
    <CaseOutlinePreview {config} />
    <ChoiceGroup
      label={fr ? 'Attache du bracelet' : 'Strap attachment'}
      value={value.attachment}
      options={[
        { value: 'lugs', label: fr ? 'Cornes' : 'Lugs' },
        { value: 'block', label: fr ? 'Intégrée' : 'Integrated' },
        { value: 'none', label: fr ? 'Sans cornes' : 'No lugs' },
      ]}
      onchange={attachment}
    />
    {#if value.attachment === 'none'}
      <p class="note">
        {fr
          ? 'Le bracelet se glisse dans une poche creusée sous la carrure, à 12 h et 6 h : le bord du boîtier reste entier vu de face.'
          : 'The strap slides into a pocket carved beneath the case at 12 and 6 o’clock: seen from the front, the case edge stays whole.'}
      </p>
    {/if}
    {#if lugs}
      <ChoiceGroup
        label={fr ? 'Point de départ' : 'Starting point'}
        value={preset}
        options={LUG_PRESETS.map((drawing, i) => ({ value: drawing, label: presetNames[i]! }))}
        onchange={ondrawing}
      />
      <p class="note">
        {preset
          ? fr
            ? 'Un dessin de départ, à ajuster librement ci-dessous.'
            : 'A starting drawing, freely adjustable below.'
          : fr
            ? 'Dessin personnalisé · choisir un point de départ le remplace.'
            : 'Custom drawing · choosing a starting point replaces it.'}
      </p>
    {/if}
    {#if attached}
      {@render range({
        key: 'lugWidthMm',
        label:
          value.attachment === 'block'
            ? fr
              ? 'Largeur des attaches'
              : 'Attachment width'
            : fr
              ? 'Largeur des cornes'
              : 'Lug width',
        min: 1.2,
        max: 5,
        step: 0.05,
        metric: true,
      })}
      {@render range({
        key: 'taper',
        label: fr ? 'Effilement' : 'Taper',
        hint: fr ? 'Droite → affinée vers la pointe' : 'Straight → narrowing towards the tip',
      })}
      {@render range({
        key: 'swell',
        label: fr ? 'Renflement' : 'Fullness',
        hint: fr
          ? 'Effilée → pleine · garde sa largeur puis se ferme vers la pointe'
          : 'Slender → full · keeps its width, then closes into the tip',
      })}
      {@render range({ key: 'tipRound', label: fr ? 'Arrondi des pointes' : 'Tip roundness' })}
      {@render range({
        key: 'sectionRound',
        label: fr ? 'Section bombée' : 'Domed section',
        hint: fr
          ? 'Plate → bombée · le dessus s’arrondit vers les côtés, comme une goutte'
          : 'Flat → domed · the top rounds off towards the sides, like a teardrop',
      })}
    {/if}
    {#if attached || guard}
      {@render range({
        key: 'integration',
        label: fr ? 'Fondu du raccord' : 'Root blend',
        hint: fr
          ? `Net → coulé dans la carrure${guard ? ' · cornes et protections' : ''}`
          : `Crisp → flowing into the case${guard ? ' · lugs and guards' : ''}`,
      })}
    {/if}
    <section>
      <Checkbox checked={guard} onchange={onguard}>
        {fr ? 'Protections de couronne' : 'Crown guards'}
      </Checkbox>
      <p class="note">
        {fr
          ? 'Deux ailettes de part et d’autre de la couronne, raccordées comme les cornes.'
          : 'Two wings either side of the crown, blended like the lugs.'}
      </p>
    </section>
  {:else if mode === 'profile'}
    <p class="intro">
      {fr
        ? 'Les attaches vues de côté : le dessus et le dessous se règlent indépendamment.'
        : 'Attachments seen from the side: top and underside are set independently.'}
    </p>
    {#if attached}<CaseProfilePreview {config} />{/if}
    {@render range({
      key: 'dome',
      label: fr ? 'Galbe du dessus' : 'Top curvature',
      hint: fr
        ? 'Tendu → bombé · la hauteur de descente vient de l’épaisseur en pointe'
        : 'Taut → domed · the drop itself comes from the tip thickness',
    })}
    {#if attached}
      {@render range({
        key: 'tipThicknessMm',
        label: fr ? 'Épaisseur en pointe' : 'Tip thickness',
        min: 0.6,
        max: Math.min(25, config.case.thicknessMm * 0.85),
        step: 0.1,
        metric: true,
      })}
      {@render range({
        key: 'transition',
        label: fr ? 'Longueur de la descente' : 'Descent length',
        hint: fr
          ? 'Courte → longue · la descente démarre plus tôt sur le boîtier et s’adoucit'
          : 'Short → long · the descent starts earlier on the case and softens',
      })}
    {/if}
    {#if attached || guard}
      <ChoiceGroup
        label={fr ? 'Dessous' : 'Underside'}
        value={value.underside}
        options={[
          { value: 'flat', label: fr ? 'Aligné sur le boîtier' : 'Aligned with case' },
          { value: 'curved', label: fr ? 'Courbe' : 'Curved' },
        ]}
        onchange={(underside) => patch({ underside: underside as CaseConstruction['underside'] })}
      />
      <p class="note">
        {value.underside === 'flat'
          ? fr
            ? 'Le dessous des cornes et des protections reste dans le plan du boîtier.'
            : 'Lugs and guards share the case-back plane.'
          : fr
            ? 'Le dessous part du plan du boîtier et rejoint la hauteur choisie en pointe.'
            : 'The underside curves from the case-back plane to the chosen tip height.'}
      </p>
    {/if}
    {#if attached && value.underside === 'curved'}
      {@render range({
        key: 'tipOffsetMm',
        label: fr ? 'Hauteur des pointes' : 'Tip height',
        min: -4,
        max: Math.max(0, config.case.thicknessMm * 0.85 - value.tipThicknessMm),
        step: 0.1,
        metric: true,
        hint: fr
          ? '0 mm : plan du boîtier · négatif : vers le poignet'
          : '0 mm: case-back plane · negative: towards the wrist',
      })}
    {/if}
  {:else}
    <p class="intro">
      {fr
        ? 'Les arêtes suivent tout le contour : carrure, cornes, protections et bord de la lunette.'
        : 'Edges follow the whole outline: case, lugs, guards and the bezel’s outer edge.'}
    </p>
    <ChoiceGroup
      label={fr ? 'Traitement des arêtes' : 'Edge treatment'}
      value={value.edge}
      options={[
        { value: 'sharp', label: fr ? 'Vives' : 'Sharp' },
        { value: 'chamfer', label: fr ? 'Chanfrein' : 'Chamfer' },
        { value: 'rounded', label: fr ? 'Arrondi' : 'Rounded' },
      ]}
      onchange={(edge) => patch({ edge: edge as CaseConstruction['edge'] })}
    />
    {#if value.edge !== 'sharp'}
      {@render range({
        key: 'edgeSizeMm',
        label:
          value.edge === 'chamfer'
            ? fr
              ? 'Largeur du chanfrein'
              : 'Chamfer width'
            : fr
              ? 'Rayon de l’arrondi'
              : 'Edge radius',
        min: 0.05,
        max: 1.2,
        step: 0.05,
        metric: true,
      })}
    {/if}
    {#if lugs}
      <section>
        <Checkbox checked={value.drilled} onchange={(drilled) => patch({ drilled })}>
          {fr ? 'Cornes percées' : 'Drilled lugs'}
        </Checkbox>
        <p class="note">
          {fr
            ? 'Le trou de la barrette traverse la corne, pour changer de bracelet sans outil.'
            : 'The spring-bar hole goes through the lug, for tool-free strap changes.'}
        </p>
      </section>
    {/if}
  {/if}
</div>

<style>
  .case-settings {
    display: grid;
    gap: 20px;
    margin-top: 0;
  }
  .intro,
  .note {
    margin: 0;
    color: var(--ink-soft);
    font-size: var(--text-s);
    line-height: 1.5;
  }
  .note {
    margin-top: -8px;
  }
  section .note {
    margin: 5px 0 0;
  }
  section {
    border-top: 1px solid var(--control-line);
    padding-top: 16px;
  }
</style>
