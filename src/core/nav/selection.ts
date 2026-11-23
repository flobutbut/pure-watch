/**
 * Lien entre la navigation (index de variante par ligne) et la configuration
 * (valeurs dans WatchConfig).
 */
import type { Catalog, RowDef, RowId } from '../catalog/types';
import { getAtPath, matchesValue, setAtPath } from '../config/path';
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

/** Écrit la valeur de la variante choisie dans la configuration. */
export function applyVariant(config: WatchConfig, row: RowDef, variantIndex: number): WatchConfig {
  const variant = row.variants[variantIndex];
  if (!variant) return config;
  return setAtPath(config, row.path, variant.value);
}
