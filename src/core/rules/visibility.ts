/**
 * Visibilité des lignes (spec §1.2 principe 5, §4.5) : une ligne dont les prérequis ne sont
 * pas remplis disparaît de la grille au lieu d'être grisée. Première brique du moteur de
 * règles : conditions simples sur un chemin de la configuration.
 */
import type { RowDef } from '../catalog/types';
import { getAtPath, matchesValue } from '../config/path';
import type { WatchConfig } from '../config/types';

/**
 * Condition : `{ path, equals }`, `{ path, notEquals }`, `{ path, in: [...] }`, `{ path, notIn: [...] }`,
 * ou `{ all: [...] }` / `{ any: [...] }` pour combiner.
 */
export function evaluate(rule: Record<string, unknown>, config: WatchConfig): boolean {
  if (Array.isArray(rule['all'])) {
    return (rule['all'] as Record<string, unknown>[]).every((r) => evaluate(r, config));
  }
  if (Array.isArray(rule['any'])) {
    return (rule['any'] as Record<string, unknown>[]).some((r) => evaluate(r, config));
  }
  const path = rule['path'];
  if (typeof path !== 'string') return true; // règle inconnue : on n'empêche rien
  const actual = getAtPath(config, path);
  if ('equals' in rule) return matchesValue(actual, rule['equals']);
  if ('notEquals' in rule) return !matchesValue(actual, rule['notEquals']);
  if (Array.isArray(rule['in'])) return rule['in'].some((v) => matchesValue(actual, v));
  if (Array.isArray(rule['notIn'])) return !rule['notIn'].some((v) => matchesValue(actual, v));
  return true;
}

export function visibleRows(rows: readonly RowDef[], config: WatchConfig): RowDef[] {
  // Palettes and complication styles remain catalog metadata for presets, settings and old links.
  return rows.filter(
    (row) =>
      row.kind !== 'palette' &&
      !['small-seconds-style', 'chronograph-counters', 'power-reserve-style'].includes(row.id) &&
      (!row.visibleWhen || evaluate(row.visibleWhen, config)),
  );
}
