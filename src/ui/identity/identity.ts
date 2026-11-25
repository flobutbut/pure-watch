/** Contenu de la fiche d'identité : la configuration lue comme une fiche technique. */
import rawCatalog from '../../data/catalog.json';
import { CATALOG_EN } from '../../core/i18n/catalog-en';
import type { RowDef } from '../../core/catalog/types';
import { ralName, tint } from '../../core/color/names';
import { bezelScale, hasBezelInsert, bezelLayout, bezelShape } from '../../core/config/bezel';
import { handAdjustment, handStyle } from '../../core/config/hands';
import { PART_SETTINGS } from '../colors/part-settings';
import { detailTraits } from './detail-traits';
import { lugJoin } from '../../core/config/lugs';
import { LUG_SETTINGS } from '../colors/lug-settings';
import { handColor, indexColor, INDEX_FINISHES } from '../../core/config/colors';
import { hasLume, lumeChoice, lumePigment } from '../../core/config/lume';
import { dateComplication } from '../../core/config/date';
import { chronograph } from '../../core/config/chronograph';
import { powerReserve } from '../../core/config/power-reserve';
import { smallSeconds } from '../../core/config/small-seconds';
import { subdialHand } from '../../core/config/subdial-hand';
import { subdialAppearance, reserveAppearance } from '../../core/config/subdials';
import { subdialStyle } from '../../core/config/subdial-style';
import { SUBDIAL_HAND_LABELS } from '../colors/subdial-hand-labels';
import { numeralSystem } from '../../core/config/numerals';
import {
  chapterRingColor,
  effectiveDialColor,
  hasIntrinsicColor,
  numeralColor,
} from '../../core/config/dial';
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
  'fixed-bezel-scale': bezelScale,
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
  const share = (value: number, of: 'size' | 'length' | 'width' | 'distance') =>
    Math.abs(value - 1) < 0.005 ? m.standard : m.share(Math.round(value * 100), of);

  if (row.id === 'dial-finish' && !hasIntrinsicColor(config.dial.finish)) {
    const color = effectiveDialColor(config.dial);
    if (PAINTED_DIALS.has(config.dial.finish)) return [painted(m.dialColor, color)];
    // Sunburst, guilloché, fumé… : the tone comes from a galvanic or PVD process, not a paint.
    return [{ label: m.dialColor, value: tintName(color), swatch: color, reference: m.sample }];
  }
  if (row.id === 'chapter-ring' && config.dial.chapterRing !== 'none') {
    const color = config.dial.chapterRingColor;
    return [
      color === 'match'
        ? { label: m.chapterRingColor, value: m.dialInk, swatch: chapterRingColor(config.dial) }
        : painted(m.chapterRingColor, color),
    ];
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
    const { indexLength, indexWidth, indexRadius } = config.dial.indices;
    const finish =
      INDEX_FINISHES.find((item) => item.id === config.dial.indices.finish)?.name ?? 'polished';
    return [
      {
        label: all.lume.indexFinish,
        value: finish === 'printed' ? all.lume.printed : (all.handFinish[finish] ?? finish),
        swatch: indexColor(config),
        metal: !['printed', 'lacquer'].includes(finish),
      },
      { label: m.indexLength, value: share(indexLength, 'length') },
      { label: m.indexWidth, value: share(indexWidth, 'width') },
      { label: m.indexPosition, value: share(indexRadius, 'distance') },
    ];
  }
  if (row.id === 'bezel' && hasBezelInsert(config))
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
    // Guichet et disque se règlent dans le panneau de la date : la fiche les montre sous elle.
    if (row.id === 'date' && dateComplication(config))
      for (const id of ['date-window', 'date-disc', 'date-loupe']) {
        const definition = rawCatalog.rows.find((r) => r.id === id)! as RowDef;
        const selected = definition.variants.find((v) =>
          matchesValue(EFFECTIVE[id]?.(config) ?? getAtPath(config, definition.path), v.value),
        );
        section.traits.push({
          label: locale === 'en' ? CATALOG_EN[id]!.name : definition.i18n.name,
          value: selected
            ? locale === 'en'
              ? (CATALOG_EN[id]?.variants?.[selected.id] ?? selected.i18n.name)
              : selected.i18n.name
            : '—',
        });
      }
    const styleId =
      row.id === 'small-seconds' && smallSeconds(config)
        ? 'small-seconds-style'
        : row.id === 'chronograph' && chronograph(config)
          ? 'chronograph-counters'
          : row.id === 'power-reserve' && powerReserve(config)
            ? 'power-reserve-style'
            : null;
    if (styleId) {
      const definition = rawCatalog.rows.find((r) => r.id === styleId)!;
      const selected = definition.variants.find((v) => v.value === EFFECTIVE[styleId]!(config));
      section.traits.push({
        label:
          styleId === 'small-seconds-style'
            ? m.colors.subdialRelief
            : locale === 'en'
              ? CATALOG_EN[styleId]!.name
              : definition.i18n.name,
        value: selected
          ? locale === 'en'
            ? (CATALOG_EN[styleId]?.variants?.[selected.id] ?? selected.i18n.name)
            : selected.i18n.name
          : '—',
      });
    }
    if (styleId && styleId !== 'small-seconds-style') {
      const definition = rawCatalog.rows.find((r) => r.id === 'small-seconds-style')!;
      const style = subdialStyle(config, row.id === 'power-reserve' ? 'reserve' : 'subdials');
      const selected = definition.variants.find((v) => v.value === style)!;
      section.traits.push({
        label: m.colors.subdialRelief,
        value:
          locale === 'fr'
            ? selected.i18n.name
            : CATALOG_EN['small-seconds-style']!.variants![selected.id]!,
      });
    }
    if (styleId) {
      const hand = subdialHand(config, row.id === 'power-reserve');
      const labels = SUBDIAL_HAND_LABELS[locale];
      section.traits.push({
        label:
          row.id === 'power-reserve'
            ? locale === 'fr'
              ? 'Aiguille de réserve'
              : 'Power reserve hand'
            : labels.title,
        value: labels.styles[hand.style] ?? hand.style,
      });
      if (hand.style !== 'none')
        section.traits.push({
          label:
            row.id === 'power-reserve'
              ? locale === 'fr'
                ? 'Couleur de l’aiguille de réserve'
                : 'Reserve hand colour'
              : labels.color,
          value: hand.color === 'match' ? m.colors.matchHands : hand.color,
          swatch: hand.color === 'match' ? handColor(config) : hand.color,
          metal: hand.color === 'match' && config.hands.finish !== 'lacquer',
        });
    }
    const mini = row.id === 'power-reserve' ? reserveAppearance(config) : subdialAppearance(config);
    if (styleId && mini.customFinish) {
      const finish = mini.config.dial.finish;
      section.traits.push({
        label: row.id === 'power-reserve' ? m.colors.reserveFinish : m.colors.subdialFinish,
        value:
          finish === 'azure'
            ? m.colors.azureFinish
            : (rows.find((r) => r.id === 'dial-finish')?.variants.find((v) => v.value === finish)
                ?.i18n.name ?? finish),
      });
    }
    section.traits.push(...detailTraits(row.id, config, locale));
    if (row.id === 'lugs' && config.case.lugs !== 'none')
      section.traits.push({
        label: LUG_SETTINGS[locale].label,
        value: LUG_SETTINGS[locale].names[lugJoin(config)],
      });
    const settings = PART_SETTINGS[locale];
    if (
      row.id === 'hands' &&
      ['hour', 'minute'].some((part) => {
        const a = handAdjustment(config.hands, part as 'hour' | 'minute');
        return a.style !== 'match' || a.length !== 1 || a.width !== 1;
      })
    ) {
      for (const part of ['hour', 'minute'] as const) {
        const a = handAdjustment(config.hands, part);
        section.traits.push(
          {
            label: part === 'hour' ? settings.hourDesign : settings.minuteDesign,
            value: settings.styles[handStyle(config.hands, part)] ?? handStyle(config.hands, part),
          },
          {
            label: part === 'hour' ? settings.hourLength : settings.minuteLength,
            value: `${Math.round(a.length * 100)} %`,
          },
          {
            label: part === 'hour' ? settings.hourWidth : settings.minuteWidth,
            value: `${Math.round(a.width * 100)} %`,
          },
        );
      }
    }
    if (row.id === 'bezel') {
      const b = bezelLayout(config);
      if (b.shape !== 'case' || b.width !== 1 || b.height !== 1 || b.finish !== 'case') {
        const d = watchDimensions(config);
        section.traits.push(
          {
            label: settings.bezelShape,
            value: settings.shapes[bezelShape(config)] ?? bezelShape(config),
          },
          { label: settings.bezelWidth, value: len(Number(d.bezelWidth.toFixed(2))) },
          {
            label: settings.bezelHeight,
            value: `${Math.round(b.height * 100)} %`,
          },
          { label: settings.bezelFinish, value: settings.finishes[b.finish] ?? b.finish },
        );
      }
    }
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
