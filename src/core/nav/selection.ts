/**
 * Lien entre la navigation (index de variante par ligne) et la configuration
 * (valeurs dans WatchConfig).
 */
import type { Catalog, RowDef, RowId } from '../catalog/types';
import { getAtPath, matchesValue, setAtPath } from '../config/path';
import { resolveLayout } from '../config/complications';
import type { WatchConfig } from '../config/types';
import type { RowView } from './state';

export function toRowViews(rows: readonly RowDef[]): RowView[] {
  return rows.map((row) => ({
    id: row.id,
    variantCount: row.variants.length,
    looping: row.looping,
  }));
}

/** Index de la variante qui correspond à la configuration, ou 0 si aucune. */
export function variantIndexFromConfig(row: RowDef, config: WatchConfig): number {
  const actual = getAtPath(config, row.path);
  const index = row.variants.findIndex((variant) => matchesValue(actual, variant.value));
  return index === -1 ? 0 : index;
}

/** Sélection initiale de chaque ligne, déduite d'une configuration (chargement d'un lien). */
export function selectionFromConfig(catalog: Catalog, config: WatchConfig): Record<RowId, number> {
  return Object.fromEntries(
    catalog.rows.map((row) => [row.id, variantIndexFromConfig(row, config)]),
  );
}

/**
 * Écrit la valeur de la variante choisie dans la configuration. Une complication placée
 * sur une position occupée en déloge l'autre (voir resolveLayout).
 */
export function applyVariant(config: WatchConfig, row: RowDef, variantIndex: number): WatchConfig {
  const variant = row.variants[variantIndex];
  if (!variant) return config;
  const next = setAtPath(config, row.path, variant.value);
  const type = /^complications\.([^.]+)$/.exec(row.path)?.[1];
  return type ? resolveLayout(next, type) : next;
}

/**
 * Sélection des lignes dont la valeur a changé par contrecoup (une date délogée) :
 * la grille repart de la variante réellement portée par la montre.
 */
export function syncSelection(
  catalog: Catalog,
  before: WatchConfig,
  after: WatchConfig,
  selection: Readonly<Record<RowId, number>>,
  except: RowId,
): Record<RowId, number> {
  const out = { ...selection };
  for (const row of catalog.rows) {
    if (row.id === except) continue;
    const was = JSON.stringify(getAtPath(before, row.path));
    if (was !== JSON.stringify(getAtPath(after, row.path)))
      out[row.id] = variantIndexFromConfig(row, after);
  }
  return out;
}
