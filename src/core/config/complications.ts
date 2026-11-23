/**
 * Règles communes aux complications : heures qu'elles masquent, et partage des
 * emplacements (spec §4.5, règle « layout » : deux complications ne prennent pas la même
 * position).
 */
import { DATE_POSITIONS } from './date';
import { CHRONO_LAYOUTS, layoutPositions } from './chronograph';
import { POWER_RESERVE_POSITIONS } from './power-reserve';
import { SMALL_SECONDS_POSITIONS } from './small-seconds';
import type { ComplicationConfig, WatchConfig } from './types';

/** Positions possibles de chaque complication, dans l'ordre de préférence. */
export const COMPLICATION_POSITIONS: Readonly<Record<string, readonly string[]>> = {
  date: Object.keys(DATE_POSITIONS),
  'small-seconds': Object.keys(SMALL_SECONDS_POSITIONS),
  'power-reserve': Object.keys(POWER_RESERVE_POSITIONS),
  // Le chronographe se place par disposition, qui occupe plusieurs heures.
  chronograph: Object.keys(CHRONO_LAYOUTS),
};

/** Le chronographe a sa propre petite seconde : les deux ne vont pas ensemble. */
const EXCLUDES: Readonly<Record<string, readonly string[]>> = {
  chronograph: ['small-seconds'],
  'small-seconds': ['chronograph'],
};

/** Heures du cadran prises par une complication (vide si sa position est inconnue). */
export function occupies(c: { type: string; position: string }): string[] {
  const known = COMPLICATION_POSITIONS[c.type];
  // Type inconnu (lien d'une version future) : il garde sa place, telle quelle.
  if (!known) return [c.position];
  if (!known.includes(c.position)) return [];
  return c.type === 'chronograph' ? layoutPositions(c.position) : [c.position];
}

const HOURS: Readonly<Record<string, number>> = { '12h': 0, '3h': 3, '6h': 6, '9h': 9 };

/** Heures (0 = 12 h) dont l'index et le chiffre cèdent la place à une complication. */
export function complicationHours(config: WatchConfig): number[] {
  const hours = config.complications
    // Seules les complications connues occupent le cadran.
    .flatMap((c) => (c.type in COMPLICATION_POSITIONS ? occupies(c) : []))
    .flatMap((p) => (p in HOURS ? [HOURS[p]!] : []));
  return [...new Set(hours)];
}

/**
 * Après le choix de `keep`, les autres complications quittent sa position pour la première
 * position libre qu'elles acceptent ; sans place libre, elles sont retirées.
 */
export function resolveLayout(config: WatchConfig, keep: string): WatchConfig {
  const kept = config.complications.find((c) => c.type === keep);
  if (!kept) return config;
  const excluded = new Set(EXCLUDES[keep] ?? []);
  const others = config.complications.filter((c) => c !== kept && !excluded.has(c.type));
  // D'abord les positions que personne ne conteste, ensuite seulement les déménagements.
  const taken = new Set(occupies(kept));
  const movers = new Set<ComplicationConfig>();
  for (const c of others) {
    const spots = occupies(c);
    if (spots.some((p) => taken.has(p))) movers.add(c);
    else for (const p of spots) taken.add(p);
  }
  let changed = others.length + 1 !== config.complications.length || movers.size > 0;
  const complications = config.complications.flatMap((c) => {
    if (c !== kept && excluded.has(c.type)) return [];
    if (!movers.has(c)) return [c];
    const free = (COMPLICATION_POSITIONS[c.type] ?? []).find((p) =>
      occupies({ type: c.type, position: p }).every((spot) => !taken.has(spot)),
    );
    if (!free) return [];
    for (const spot of occupies({ type: c.type, position: free })) taken.add(spot);
    return [{ ...c, position: free }];
  });
  // Les poussoirs encadrent la couronne à 3 h.
  const crown =
    complications.some((c) => c.type === 'chronograph') && config.crown.position !== '3h'
      ? { ...config.crown, position: '3h' }
      : config.crown;
  changed ||= crown !== config.crown;
  return changed ? { ...config, complications, crown } : config;
}
