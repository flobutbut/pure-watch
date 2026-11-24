/** Contenu de la fiche d'identité : la configuration lue comme une fiche technique. */
import type { RowDef } from '../../core/catalog/types';
import { ralName, tint } from '../../core/color/names';
import { bezelScale } from '../../core/config/bezel';
import { handColor, indexColor, INDEX_FINISHES } from '../../core/config/colors';
import { hasLume, lumeChoice, lumePigment } from '../../core/config/lume';
import { dateComplication } from '../../core/config/date';
import { chronograph } from '../../core/config/chronograph';
import { powerReserve } from '../../core/config/power-reserve';
import { smallSeconds } from '../../core/config/small-seconds';
import { numeralSystem } from '../../core/config/numerals';
import { effectiveDialColor, hasIntrinsicColor, numeralColor } from '../../core/config/dial';
import { getAtPath, matchesValue } from '../../core/config/path';
import {
  effectiveRehautProfile,
  effectiveRehautScale,
  rehautColor,
} from '../../core/config/rehaut';
import type { WatchConfig } from '../../core/config/types';
import { watchDimensions } from '../../core/geometry/dimensions';
import type { Locale } from '../../core/i18n/locale';
import { MESSAGES, type Messages } from '../../core/i18n/messages';
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

const GROUP_TITLES = ['case', 'face', 'hands', 'complications'] as const;
const groupTitle = (group: string, m: Messages['identity']) =>
  GROUP_TITLES.find((id) => id === group) ? m[group as (typeof GROUP_TITLES)[number]] : m.others;

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
  'power-reserve-style': (config) => powerReserve(config)?.style,
  'chronograph-counters': (config) => chronograph(config)?.counters,
  'chronograph-pushers': (config) => chronograph(config)?.pushers,
};

function rowValue(row: RowDef, config: WatchConfig): string {
  const actual = EFFECTIVE[row.id]?.(config) ?? getAtPath(config, row.path);
  const variant = row.variants.find((v) => matchesValue(actual, v.value));
  if (variant) return variant.i18n.name;
  return typeof actual === 'string' || typeof actual === 'number' ? String(actual) : '—';
}

/** Finitions dont la couleur vient d'une peinture ou d'une laque : RAL a un sens. */
const PAINTED_DIALS = new Set(['matte', 'lacquer']);

/** Colours are not grid rows: they follow the row whose panel edits them. */
function colorTraits(row: RowDef, config: WatchConfig, locale: Locale): Trait[] {
  const all = MESSAGES[locale];
  const m = all.identity;
  const tintName = (color: string) => tint(color, locale).name;
  /** A painted or lacquered surface: its name, and the nearest RAL as a maker's reference. */
  const painted = (label: string, color: string): Trait => {
    const { name, ral } = tint(color, locale);
    const ralLabel = ral ? ralName(ral, locale) : '';
    return {
      label,
      value: name,
      swatch: color,
      reference: ral ? `≈ RAL ${ral.code}${ralLabel === name ? '' : ` ${ralLabel}`}` : m.noRal,
    };
  };
  const share = (value: number, of: 'size' | 'distance') =>
    Math.abs(value - 1) < 0.005 ? m.standard : m.share(Math.round(value * 100), of);

  if (row.id === 'dial-finish' && !hasIntrinsicColor(config.dial.finish)) {
    const color = effectiveDialColor(config.dial);
    if (PAINTED_DIALS.has(config.dial.finish)) return [painted(m.dialColor, color)];
    // Sunburst, guilloché, fumé… : the tone comes from a galvanic or PVD process, not a paint.
    return [{ label: m.dialColor, value: tintName(color), swatch: color, reference: m.sample }];
  }
  if (row.id === 'hands') {
    if (config.hands.finish === 'lacquer')
      return [
        {
          ...painted(m.handsMaterial, config.hands.color),
          value: m.lacquered(tintName(config.hands.color)),
        },
      ];
    return [
      {
        label: m.handsMaterial,
        value: all.handFinish[config.hands.finish] ?? config.hands.finish,
        swatch: handColor(config),
        metal: true,
      },
    ];
  }
  if (row.id === 'seconds' && config.hands.second.style !== 'none') {
    if (config.hands.second.color !== 'match')
      return [painted(m.secondsColor, config.hands.second.color)];
    return [
      {
        label: m.secondsColor,
        value: m.matchHands,
        swatch: handColor(config),
        metal: config.hands.finish !== 'lacquer',
      },
    ];
  }
  if (row.id === 'rehaut') {
    if (config.rehaut.finish === 'custom') return [painted(m.rehautTint, config.rehaut.color)];
    return [
      {
        label: m.rehautTint,
        value: all.rehautFinish[config.rehaut.finish] ?? config.rehaut.finish,
        swatch: rehautColor(config),
        metal: config.rehaut.finish === 'metal',
      },
    ];
  }
  // Writing system and layout share the panel attached to the numeral positions.
  if (row.id === 'numerals' && config.dial.indices.numerals !== 'none') {
    const { numeralSize, numeralRadius, numeralColor: color } = config.dial.indices;
    return [
      {
        label: m.numeralScript,
        value: numeralSystem(config.dial.indices) === 'roman' ? m.roman : m.arabic,
      },
      { label: m.numeralSize, value: share(numeralSize, 'size') },
      { label: m.numeralPosition, value: share(numeralRadius, 'distance') },
      color === 'match'
        ? { label: m.numeralColor, value: m.dialInk, swatch: numeralColor(config.dial) }
        : painted(m.numeralColor, color),
    ];
  }
  if (row.id === 'indices' && config.dial.indices.style !== 'none') {
    const { indexSize, indexRadius } = config.dial.indices;
    const finish =
      INDEX_FINISHES.find((item) => item.id === config.dial.indices.finish)?.name ?? 'polished';
    return [
      {
        label: all.lume.indexFinish,
        value: finish === 'printed' ? all.lume.printed : (all.handFinish[finish] ?? finish),
        swatch: indexColor(config),
        metal: !['printed', 'lacquer'].includes(finish),
      },
      { label: m.indexSize, value: share(indexSize, 'size') },
      { label: m.indexPosition, value: share(indexRadius, 'distance') },
    ];
  }
  if (row.id === 'bezel' && config.bezel.type === 'rotating')
    return [painted(m.bezelColor, config.bezel.color)];
  return [];
}

/** Cotes d'abord, puis chaque pièce dans l'ordre de la grille. */
export function identitySections(
  rows: readonly RowDef[],
  config: WatchConfig,
  locale: Locale = 'fr',
): TraitSection[] {
  const m = MESSAGES[locale];
  const len = (value: number, digits = 2) => mm(value, digits, locale);
  const sections: TraitSection[] = [
    {
      title: m.identity.dimensions,
      traits: [
        { label: m.dimensions.diameterMm, value: len(config.case.diameterMm) },
        { label: m.dimensions.thicknessMm, value: len(config.case.thicknessMm) },
        { label: m.dimensions.lugToLugMm, value: len(config.case.lugToLugMm) },
        { label: m.dimensions.lugWidthMm, value: len(config.case.lugWidthMm) },
        {
          label: m.identity.visibleDial,
          value: len(Math.round(visibleDialMm(config) * 10) / 10, 1),
        },
      ],
    },
  ];
  for (const row of rows) {
    // La taille est déjà détaillée dans les cotes.
    if (row.id === 'case-size') continue;
    const title = groupTitle(row.group, m.identity);
    let section = sections.find((s) => s.title === title);
    if (!section) sections.push((section = { title, traits: [] }));
    section.traits.push({ label: row.i18n.name, value: rowValue(row, config) });
    section.traits.push(...colorTraits(row, config, locale));
    if (row.id === 'hands' || (row.id === 'indices' && config.dial.indices.style !== 'none')) {
      const part = row.id === 'hands' ? config.hands : config.dial.indices;
      const lm = m.lume;
      section.traits.push({
        label: row.id === 'hands' ? lm.hands : lm.indices,
        value: hasLume(part) ? lm.enabled : lm.disabled,
      });
      if (hasLume(part)) {
        const selected = lumeChoice(part);
        const pigment = lumePigment(selected.kind)!;
        section.traits.push(
          { label: lm.pigment, value: pigment.name },
          { label: lm.day, value: tint(selected.day, locale).name, swatch: selected.day },
          {
            label: lm.emission,
            value: tint(selected.night, locale).name,
            swatch: selected.night,
          },
        );
      }
    }
  }
  return sections;
}
