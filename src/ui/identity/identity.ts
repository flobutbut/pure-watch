/** Contenu de la fiche d'identité : la configuration lue comme une fiche technique. */
import type { RowDef } from '../../core/catalog/types';
import { bezelScale } from '../../core/config/bezel';
import { HAND_FINISHES, handColor } from '../../core/config/colors';
import { effectiveDialColor, hasIntrinsicColor } from '../../core/config/dial';
import { getAtPath, matchesValue } from '../../core/config/path';
import {
  effectiveRehautProfile,
  effectiveRehautScale,
  REHAUT_FINISHES,
  rehautColor,
} from '../../core/config/rehaut';
import type { WatchConfig } from '../../core/config/types';
import { watchDimensions } from '../../core/geometry/dimensions';
import { mm, visibleDialMm } from '../../core/movement/compatibility';

export interface Trait {
  label: string;
  value: string;
  /** Couleur à montrer en pastille ; `metal` donne le reflet des finitions métalliques. */
  swatch?: string;
  metal?: boolean;
}

export interface TraitSection {
  title: string;
  traits: Trait[];
}

const GROUP_TITLES: Record<string, string> = {
  case: 'Boîtier',
  face: 'Cadran',
  hands: 'Aiguilles',
};

/** Values the renderer substitutes: the card shows what the watch actually wears. */
const EFFECTIVE: Record<string, (config: WatchConfig) => unknown> = {
  'bezel-scale': bezelScale,
  rehaut: effectiveRehautProfile,
  'rehaut-scale': effectiveRehautScale,
  // A rotating bezel needs a round opening, whatever the chosen dial outline.
  'dial-shape': (config) => watchDimensions(config).dialShape,
};

function rowValue(row: RowDef, config: WatchConfig): string {
  const actual = EFFECTIVE[row.id]?.(config) ?? getAtPath(config, row.path);
  const variant = row.variants.find((v) => matchesValue(actual, v.value));
  if (variant) return variant.i18n.name;
  return typeof actual === 'string' || typeof actual === 'number' ? String(actual) : '—';
}

/** Colours are not grid rows: they follow the row whose panel edits them. */
function colorTraits(row: RowDef, config: WatchConfig): Trait[] {
  if (row.id === 'dial-finish' && !hasIntrinsicColor(config.dial.finish)) {
    const color = effectiveDialColor(config.dial);
    return [{ label: 'Couleur du cadran', value: color.toUpperCase(), swatch: color }];
  }
  if (row.id === 'hands') {
    const finish = HAND_FINISHES.find((f) => f.id === config.hands.finish);
    const lacquer = config.hands.finish === 'lacquer';
    return [
      {
        label: 'Matière des aiguilles',
        value: lacquer ? `Laqué ${config.hands.color}` : (finish?.name ?? config.hands.finish),
        swatch: handColor(config),
        metal: !lacquer,
      },
    ];
  }
  if (row.id === 'seconds') {
    const match = config.hands.second.color === 'match';
    return [
      {
        label: 'Couleur de la trotteuse',
        value: match ? 'Assortie aux aiguilles' : config.hands.second.color,
        swatch: match ? handColor(config) : config.hands.second.color,
        metal: match && config.hands.finish !== 'lacquer',
      },
    ];
  }
  if (row.id === 'rehaut') {
    const finish = REHAUT_FINISHES.find((f) => f.id === config.rehaut.finish);
    return [
      {
        label: 'Teinte du réhaut',
        value:
          config.rehaut.finish === 'custom'
            ? config.rehaut.color
            : (finish?.name ?? config.rehaut.finish),
        swatch: rehautColor(config),
        metal: config.rehaut.finish === 'metal',
      },
    ];
  }
  if (row.id === 'bezel' && config.bezel.type === 'rotating')
    return [
      { label: 'Couleur de la lunette', value: config.bezel.color, swatch: config.bezel.color },
    ];
  return [];
}

/** Cotes d'abord, puis chaque pièce dans l'ordre de la grille. */
export function identitySections(rows: readonly RowDef[], config: WatchConfig): TraitSection[] {
  const sections: TraitSection[] = [
    {
      title: 'Dimensions',
      traits: [
        { label: 'Diamètre', value: mm(config.case.diameterMm) },
        { label: 'Épaisseur', value: mm(config.case.thicknessMm) },
        { label: 'Entre-cornes', value: mm(config.case.lugToLugMm) },
        { label: 'Largeur du bracelet', value: mm(config.case.lugWidthMm) },
        { label: 'Cadran visible', value: mm(Math.round(visibleDialMm(config) * 10) / 10) },
      ],
    },
  ];
  for (const row of rows) {
    // La taille est déjà détaillée dans les cotes.
    if (row.id === 'case-size') continue;
    const title = GROUP_TITLES[row.group] ?? 'Autres';
    let section = sections.find((s) => s.title === title);
    if (!section) sections.push((section = { title, traits: [] }));
    section.traits.push({ label: row.i18n.name, value: rowValue(row, config) });
    section.traits.push(...colorTraits(row, config));
  }
  return sections;
}
