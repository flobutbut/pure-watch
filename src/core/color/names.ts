/**
 * Nom d'une teinte pour l'interface : on parle « Bleu nuit », pas « #1E3A6B ».
 * Une teinte du catalogue, ou très proche, garde son nom ; une couleur libre prend celui
 * de la teinte RAL la plus proche, qui sert aussi de référence de fabrication.
 */
import rawCatalog from '../../data/catalog.json';
import { normalizeHex } from '../config/colors';
import { variantNameEn } from '../i18n/catalog-en';
import type { Locale } from '../i18n/locale';
import { MESSAGES } from '../i18n/messages';
import { deltaE2000, hexToLab } from './delta-e';
import { nearestRal, type RalColor } from './ral';
import { RAL_NAMES_EN } from './ral-en';

type Names = Record<Locale, string>;

const PRESETS = new Map<string, Names>();
for (const row of rawCatalog.rows)
  if (row.kind === 'palette')
    for (const variant of row.variants) {
      const hex = typeof variant.value === 'string' ? normalizeHex(variant.value) : null;
      if (hex && !PRESETS.has(hex))
        PRESETS.set(hex, {
          fr: variant.i18n.name,
          en: variantNameEn(row.id, variant.id) ?? variant.i18n.name,
        });
    }

/** A colour this close to a catalogue tint (CIEDE2000) borrows its friendlier name. */
const PRESET_DELTA = 4;
const presetLabs = [...PRESETS].map(([hex, names]) => ({ names, lab: hexToLab(hex)! }));

function presetName(hex: string): Names | undefined {
  const exact = PRESETS.get(hex);
  if (exact) return exact;
  const lab = hexToLab(hex)!;
  let best: { names: Names; delta: number } | undefined;
  for (const preset of presetLabs) {
    const delta = deltaE2000(lab, preset.lab);
    if (delta <= PRESET_DELTA && (!best || delta < best.delta))
      best = { names: preset.names, delta };
  }
  return best?.names;
}

/** Nom d'une teinte RAL dans la langue demandée (le nuancier est en français). */
export function ralName(ral: RalColor, locale: Locale = 'fr'): string {
  return locale === 'en' ? (RAL_NAMES_EN.get(ral.code) ?? ral.name) : ral.name;
}

export interface Tint {
  name: string;
  /** Teinte RAL la plus proche, quand elle est assez proche pour servir de référence. */
  ral?: RalColor;
}

export function tint(color: string, locale: Locale = 'fr'): Tint {
  const custom = MESSAGES[locale].tint.custom;
  const hex = normalizeHex(color);
  if (!hex) return { name: custom };
  const ral = nearestRal(hex)?.ral;
  return { name: presetName(hex)?.[locale] ?? (ral ? ralName(ral, locale) : custom), ral };
}
