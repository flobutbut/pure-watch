/**
 * Navigation en croix (spec §2.1, §2.5, §2.11). Réducteur pur : aucune dépendance à
 * l'interface, testable seul. La couche d'entrée (clavier, molette, tactile, souris)
 * traduit chaque geste en NavCommand.
 */
import type { RowId } from '../catalog/types';

/** Ce que la navigation a besoin de savoir d'une ligne visible. */
export interface RowView {
  id: RowId;
  variantCount: number;
  /** Boucle (lignes cycliques) ou bord (défaut, spec §2.5). */
  looping: boolean;
}

export type NavMode = 'grid' | 'opening3d' | 'view3d' | 'closing3d';

export interface NavState {
  /** Index dans la liste des lignes visibles. */
  activeRow: number;
  /** Index de la variante sélectionnée, par ligne. Chaque ligne garde sa sélection. */
  selectionByRow: Readonly<Record<RowId, number>>;
  mode: NavMode;
}

export type NavCommand =
  /** ← → , molette horizontale, balayage horizontal (jusqu'à ±3 avec l'inertie). */
  | { type: 'variant'; delta: number }
  /** ↑ ↓ , molette verticale, balayage vertical ; Page ↑ ↓ = ±5. */
  | { type: 'row'; delta: number }
  /** Début / Fin. */
  | { type: 'first-variant' }
  | { type: 'last-variant' }
  /** Clic ou appui sur une cellule : elle devient le centre. */
  | { type: 'goto'; row: number; variant: number };

/** Direction de l'effet de bord (rebond, spec §2.5), ou null. */
export type Bump = 'left' | 'right' | 'up' | 'down' | null;

export interface StepResult {
  state: NavState;
  /** Vrai si la ligne active ou une sélection a changé. */
  changed: boolean;
  bump: Bump;
}

export const PAGE_ROWS = 5;

export function createNavState(
  rows: readonly RowView[],
  selection: Readonly<Record<RowId, number>> = {},
  activeRow = 0,
): NavState {
  const selectionByRow: Record<RowId, number> = {};
  for (const row of rows) {
    selectionByRow[row.id] = clamp(selection[row.id] ?? 0, 0, Math.max(0, row.variantCount - 1));
  }
  return {
    activeRow: clamp(activeRow, 0, Math.max(0, rows.length - 1)),
    selectionByRow,
    mode: 'grid',
  };
}

export function selectedIndex(state: NavState, rowId: RowId): number {
  return state.selectionByRow[rowId] ?? 0;
}

export function step(state: NavState, rows: readonly RowView[], command: NavCommand): StepResult {
  // La grille est inerte tant que la vue 3D est ouverte ou en transition.
  if (state.mode !== 'grid' || rows.length === 0) return unchanged(state);

  switch (command.type) {
    case 'variant':
      return moveVariant(state, rows, command.delta);
    case 'first-variant':
      return setVariant(state, rows, 0);
    case 'last-variant': {
      const row = rows[state.activeRow];
      return row ? setVariant(state, rows, row.variantCount - 1) : unchanged(state);
    }
    case 'row':
      return moveRow(state, rows, command.delta);
    case 'goto':
      return goTo(state, rows, command.row, command.variant);
  }
}

function moveVariant(state: NavState, rows: readonly RowView[], delta: number): StepResult {
  const row = rows[state.activeRow];
  if (!row || delta === 0) return unchanged(state);
  const current = selectedIndex(state, row.id);
  const count = row.variantCount;

  if (row.looping && count > 1) {
    return withSelection(state, row.id, mod(current + delta, count), null);
  }
  const target = clamp(current + delta, 0, count - 1);
  const bump: Bump = target !== current + delta ? (delta < 0 ? 'left' : 'right') : null;
  return withSelection(state, row.id, target, bump);
}

function setVariant(state: NavState, rows: readonly RowView[], index: number): StepResult {
  const row = rows[state.activeRow];
  if (!row) return unchanged(state);
  return withSelection(state, row.id, clamp(index, 0, row.variantCount - 1), null);
}

function moveRow(state: NavState, rows: readonly RowView[], delta: number): StepResult {
  if (delta === 0) return unchanged(state);
  const target = clamp(state.activeRow + delta, 0, rows.length - 1);
  const bump: Bump = target !== state.activeRow + delta ? (delta < 0 ? 'up' : 'down') : null;
  if (target === state.activeRow) return { state, changed: false, bump };
  return { state: { ...state, activeRow: target }, changed: true, bump };
}

function goTo(
  state: NavState,
  rows: readonly RowView[],
  rowIndex: number,
  variant: number,
): StepResult {
  const activeRow = clamp(rowIndex, 0, rows.length - 1);
  const row = rows[activeRow];
  if (!row) return unchanged(state);
  const index = clamp(variant, 0, row.variantCount - 1);
  const result = withSelection({ ...state, activeRow }, row.id, index, null);
  return { ...result, changed: result.changed || activeRow !== state.activeRow };
}

function withSelection(state: NavState, rowId: RowId, index: number, bump: Bump): StepResult {
  if (selectedIndex(state, rowId) === index) return { state, changed: false, bump };
  return {
    state: { ...state, selectionByRow: { ...state.selectionByRow, [rowId]: index } },
    changed: true,
    bump,
  };
}

function unchanged(state: NavState): StepResult {
  return { state, changed: false, bump: null };
}

/* ---------- Machine à états de la vue 3D (spec §2.11) ---------- */

export type ModeEvent = 'open' | 'opened' | 'close' | 'closed';

const TRANSITIONS: Record<NavMode, Partial<Record<ModeEvent, NavMode>>> = {
  grid: { open: 'opening3d' },
  opening3d: { opened: 'view3d', close: 'closing3d' },
  view3d: { close: 'closing3d' },
  closing3d: { closed: 'grid' },
};

/** Applique un événement de la vue 3D ; un événement non prévu dans l'état courant est ignoré. */
export function transition(state: NavState, event: ModeEvent): NavState {
  const next = TRANSITIONS[state.mode][event];
  return next ? { ...state, mode: next } : state;
}

/* ---------- Utilitaires ---------- */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mod(value: number, n: number): number {
  return ((value % n) + n) % n;
}
