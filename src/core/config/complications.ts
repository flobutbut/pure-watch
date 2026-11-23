/**
 * Règles communes aux complications : heures qu'elles masquent, et partage des
 * emplacements (spec §4.5, règle « layout » : deux complications ne prennent pas la même
 * position).
 */
import { DATE_POSITIONS, dateComplication } from './date';
import { SMALL_SECONDS_POSITIONS, smallSeconds } from './small-seconds';
import type { ComplicationConfig, WatchConfig } from './types';

/** Positions possibles de chaque complication, dans l'ordre de préférence. */
export const COMPLICATION_POSITIONS: Readonly<Record<string, readonly string[]>> = {
  date: Object.keys(DATE_POSITIONS),
  'small-seconds': Object.keys(SMALL_SECONDS_POSITIONS),
};

const HOURS: Readonly<Record<string, number>> = { '12h': 0, '3h': 3, '6h': 6, '9h': 9 };

/** Heures (0 = 12 h) dont l'index et le chiffre cèdent la place à une complication. */
export function complicationHours(config: WatchConfig): number[] {
  const positions = [dateComplication(config)?.position, smallSeconds(config)?.position];
  return [...new Set(positions.flatMap((p) => (p && p in HOURS ? [HOURS[p]!] : [])))];
}

/**
 * Après le choix de `keep`, les autres complications quittent sa position pour la première
 * position libre qu'elles acceptent ; sans place libre, elles sont retirées.
 */
export function resolveLayout(config: WatchConfig, keep: string): WatchConfig {
  const kept = config.complications.find((c) => c.type === keep);
  if (!kept) return config;
  // D'abord les positions que personne ne conteste, ensuite seulement les déménagements.
  const taken = new Set([kept.position]);
  const movers = new Set<ComplicationConfig>();
  for (const c of config.complications) {
    if (c === kept) continue;
    if (taken.has(c.position)) movers.add(c);
    else taken.add(c.position);
  }
  if (movers.size === 0) return config;
  const complications = config.complications.flatMap((c) => {
    if (!movers.has(c)) return [c];
    const free = (COMPLICATION_POSITIONS[c.type] ?? []).find((p) => !taken.has(p));
    if (!free) return [];
    taken.add(free);
    return [{ ...c, position: free }];
  });
  return { ...config, complications };
}
