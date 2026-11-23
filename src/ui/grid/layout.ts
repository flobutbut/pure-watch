/**
 * Géométrie de la grille en croix (spec §2.1, §2.2, §2.6, §2.9). Fonctions pures :
 * aucune dépendance au DOM, testables seules.
 */

/** Grille de référence du fichier Figma : cellule de 160 px, pas de 216 px. */
export const REFERENCE = { cell: 160, pitch: 216 } as const;

export interface GridMetrics {
  /** Distance centre à centre entre deux cellules (px). */
  pitch: number;
  /** Diamètre d'une cellule (px). */
  cell: number;
  /** Nombre de colonnes / lignes à monter de chaque côté du centre (visibles + 1 de marge). */
  colsHalf: number;
  rowsHalf: number;
  /** Diamètre visible de la montre centrale, cornes comprises (px). */
  watch: number;
}

/**
 * Bureau : 7 colonnes × 5 lignes au pas de 216 px sur 1440 × 1024.
 * Téléphone portrait : 3 colonnes, cellule ≈ 104–120 px.
 */
export function gridMetrics(width: number, height: number): GridMetrics {
  const columnsTarget = width >= 900 ? 6.67 : 3.25;
  const pitch = Math.max(96, Math.min(REFERENCE.pitch, width / columnsTarget, height / 4.74));
  const cell = (pitch * REFERENCE.cell) / REFERENCE.pitch;
  return {
    pitch,
    cell,
    colsHalf: Math.ceil(width / 2 / pitch) + 1,
    rowsHalf: Math.ceil(height / 2 / pitch) + 1,
    watch: pitch * 1.55,
  };
}

/** Hiérarchie visuelle selon la distance au centre (spec §2.6). */
const SCALE = [1, 0.92, 0.84, 0.76, 0.7];
const OPACITY = [1, 0.9, 0.7, 0.45, 0.25];

export function hierarchy(dCol: number, dRow: number): { scale: number; opacity: number } {
  const distance = Math.min(4, Math.max(Math.abs(dCol), Math.abs(dRow)));
  return { scale: SCALE[distance]!, opacity: OPACITY[distance]! };
}

export interface CellSlot {
  rowIndex: number;
  variantIndex: number;
  /** Décalage en cellules par rapport au centre de la grille. */
  dCol: number;
  dRow: number;
}

/**
 * Cellules à monter : celles qui sont visibles plus une marge d'une cellule, pour qu'une
 * cellule soit déjà en place (et son instantané prêt) quand elle entre à l'écran.
 */
export function visibleSlots(
  rows: readonly { variantCount: number; looping?: boolean }[],
  activeRow: number,
  selected: (rowIndex: number) => number,
  metrics: Pick<GridMetrics, 'colsHalf' | 'rowsHalf'>,
): CellSlot[] {
  const slots: CellSlot[] = [];
  const firstRow = Math.max(0, activeRow - metrics.rowsHalf);
  const lastRow = Math.min(rows.length - 1, activeRow + metrics.rowsHalf);
  for (let rowIndex = firstRow; rowIndex <= lastRow; rowIndex++) {
    const { variantCount: count, looping } = rows[rowIndex]!;
    const center = selected(rowIndex);
    if (looping && count > 1) {
      // Ligne cyclique (spec §2.5) : la liste continue des deux côtés, chaque variante
      // n'apparaît qu'une fois.
      const left = Math.min(metrics.colsHalf, Math.floor((count - 1) / 2));
      const right = Math.min(metrics.colsHalf, count - 1 - left);
      for (let d = -left; d <= right; d++) {
        const variantIndex = (((center + d) % count) + count) % count;
        slots.push({ rowIndex, variantIndex, dCol: d, dRow: rowIndex - activeRow });
      }
      continue;
    }
    const first = Math.max(0, center - metrics.colsHalf);
    const last = Math.min(count - 1, center + metrics.colsHalf);
    for (let variantIndex = first; variantIndex <= last; variantIndex++) {
      slots.push({
        rowIndex,
        variantIndex,
        dCol: variantIndex - center,
        dRow: rowIndex - activeRow,
      });
    }
  }
  return slots;
}

export interface RowEnd {
  rowIndex: number;
  /** Position du point, en cellules depuis le centre : à mi-chemin entre deux cellules. */
  dCol: number;
  dRow: number;
}

/**
 * Fin de ligne (spec §2.5) : sur une ligne qui boucle, un point discret marque l'endroit
 * où la dernière variante est suivie de la première, dans l'espace entre les deux cellules.
 */
export function rowEnds(
  rows: readonly { variantCount: number; looping?: boolean }[],
  slots: readonly CellSlot[],
): RowEnd[] {
  const ends: RowEnd[] = [];
  const byPosition = new Map<string, CellSlot>();
  for (const slot of slots) byPosition.set(`${slot.rowIndex}:${slot.dCol}`, slot);
  for (const slot of slots) {
    const { variantCount: count, looping } = rows[slot.rowIndex]!;
    if (!looping || count < 2 || slot.variantIndex !== count - 1) continue;
    const next = byPosition.get(`${slot.rowIndex}:${slot.dCol + 1}`);
    if (next?.variantIndex === 0) {
      ends.push({ rowIndex: slot.rowIndex, dCol: slot.dCol + 0.5, dRow: slot.dRow });
    }
  }
  return ends;
}
