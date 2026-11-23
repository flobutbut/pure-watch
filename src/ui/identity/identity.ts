/** Contenu de la fiche d'identité : la configuration lue comme une fiche technique. */
import type { RowDef } from '../../core/catalog/types';
import { tint } from '../../core/color/names';
import { bezelScale } from '../../core/config/bezel';
import { HAND_FINISHES, handColor } from '../../core/config/colors';
import { dateComplication } from '../../core/config/date';
import { smallSeconds } from '../../core/config/small-seconds';
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
  /** Référence de fabrication, sous la valeur (RAL le plus proche, ou procédé à valider). */
  reference?: string;
}

export interface TraitSection {
  title: string;
  traits: Trait[];
}

const GROUP_TITLES: Record<string, string> = {
  case: 'Boîtier',
  face: 'Cadran',
  hands: 'Aiguilles',
  complications: 'Complications',
};

/** Values the renderer substitutes: the card shows what the watch actually wears. */
const EFFECTIVE: Record<string, (config: WatchConfig) => unknown> = {
  'bezel-scale': bezelScale,
  rehaut: effectiveRehautProfile,
  'rehaut-scale': effectiveRehautScale,
  // A rotating bezel needs a round opening, whatever the chosen dial outline.
  'dial-shape': (config) => watchDimensions(config).dialShape,
  // Champs absents : le guichet porte ses valeurs par défaut.
  'date-window': (config) => dateComplication(config)?.window,
  'date-disc': (config) => dateComplication(config)?.disc,
  'small-seconds-style': (config) => smallSeconds(config)?.style,
};

function rowValue(row: RowDef, config: WatchConfig): string {
  const actual = EFFECTIVE[row.id]?.(config) ?? getAtPath(config, row.path);
  const variant = row.variants.find((v) => matchesValue(actual, v.value));
  if (variant) return variant.i18n.name;
  return typeof actual === 'string' || typeof actual === 'number' ? String(actual) : '—';
}

/** Finitions dont la couleur vient d'une peinture ou d'une laque : RAL a un sens. */
const PAINTED_DIALS = new Set(['matte', 'lacquer']);
const SAMPLE = 'Teinte de finition, à valider sur échantillon';

/** A painted or lacquered surface: its name, and the nearest RAL as a maker's reference. */
function painted(label: string, color: string): Trait {
  const { name, ral } = tint(color);
  return {
    label,
    value: name,
    swatch: color,
    reference: ral
      ? `≈ RAL ${ral.code}${ral.name === name ? '' : ` ${ral.name}`}`
      : 'Pas d’équivalent RAL proche',
  };
}

/** Colours are not grid rows: they follow the row whose panel edits them. */
function colorTraits(row: RowDef, config: WatchConfig): Trait[] {
  if (row.id === 'dial-finish' && !hasIntrinsicColor(config.dial.finish)) {
    const color = effectiveDialColor(config.dial);
    if (PAINTED_DIALS.has(config.dial.finish)) return [painted('Couleur du cadran', color)];
    // Sunburst, guilloché, fumé… : the tone comes from a galvanic or PVD process, not a paint.
    return [
      { label: 'Couleur du cadran', value: tint(color).name, swatch: color, reference: SAMPLE },
    ];
  }
  if (row.id === 'hands') {
    if (config.hands.finish === 'lacquer')
      return [
        {
          ...painted('Matière des aiguilles', config.hands.color),
          value: `Laqué ${tint(config.hands.color).name.toLowerCase()}`,
        },
      ];
    const finish = HAND_FINISHES.find((f) => f.id === config.hands.finish);
    return [
      {
        label: 'Matière des aiguilles',
        value: finish?.name ?? config.hands.finish,
        swatch: handColor(config),
        metal: true,
      },
    ];
  }
  if (row.id === 'seconds') {
    if (config.hands.second.color !== 'match')
      return [painted('Couleur de la trotteuse', config.hands.second.color)];
    return [
      {
        label: 'Couleur de la trotteuse',
        value: 'Assortie aux aiguilles',
        swatch: handColor(config),
        metal: config.hands.finish !== 'lacquer',
      },
    ];
  }
  if (row.id === 'rehaut') {
    if (config.rehaut.finish === 'custom')
      return [painted('Teinte du réhaut', config.rehaut.color)];
    const finish = REHAUT_FINISHES.find((f) => f.id === config.rehaut.finish);
    return [
      {
        label: 'Teinte du réhaut',
        value: finish?.name ?? config.rehaut.finish,
        swatch: rehautColor(config),
        metal: config.rehaut.finish === 'metal',
      },
    ];
  }
  if (row.id === 'bezel' && config.bezel.type === 'rotating')
    return [painted('Couleur de la lunette', config.bezel.color)];
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
