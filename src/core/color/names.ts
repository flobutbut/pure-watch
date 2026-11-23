/**
 * Nom d'une teinte pour l'interface : on parle « Bleu nuit », pas « #1E3A6B ».
 * Une teinte du catalogue, ou très proche, garde son nom ; une couleur libre prend celui
 * de la teinte RAL la plus proche, qui sert aussi de référence de fabrication.
 */
import rawCatalog from '../../data/catalog.json';
import { normalizeHex } from '../config/colors';
import { deltaE2000, hexToLab } from './delta-e';
import { nearestRal, type RalColor } from './ral';

const PRESETS = new Map<string, string>();
for (const row of rawCatalog.rows)
  if (row.kind === 'palette')
    for (const variant of row.variants) {
      const hex = typeof variant.value === 'string' ? normalizeHex(variant.value) : null;
      if (hex && !PRESETS.has(hex)) PRESETS.set(hex, variant.i18n.name);
    }

/** A colour this close to a catalogue tint (CIEDE2000) borrows its friendlier name. */
const PRESET_DELTA = 4;
const presetLabs = [...PRESETS].map(([hex, name]) => ({ name, lab: hexToLab(hex)! }));

function presetName(hex: string): string | undefined {
  const exact = PRESETS.get(hex);
  if (exact) return exact;
  const lab = hexToLab(hex)!;
  let best: { name: string; delta: number } | undefined;
  for (const preset of presetLabs) {
    const delta = deltaE2000(lab, preset.lab);
    if (delta <= PRESET_DELTA && (!best || delta < best.delta)) best = { name: preset.name, delta };
  }
  return best?.name;
}

export interface Tint {
  name: string;
  /** Teinte RAL la plus proche, quand elle est assez proche pour servir de référence. */
  ral?: RalColor;
}

export function tint(color: string): Tint {
  const hex = normalizeHex(color);
  if (!hex) return { name: 'Teinte personnalisée' };
  const ral = nearestRal(hex)?.ral;
  return { name: presetName(hex) ?? ral?.name ?? 'Teinte personnalisée', ral };
}
