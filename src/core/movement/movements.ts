/**
 * Fiches des mouvements (spec §7). Seules les valeurs sourcées dans la spec (§7.3,
 * documentation Seiko / TMI) sont données ; le quartz reste générique.
 */
export interface MovementSpec {
  id: string;
  /** Nom commercial affiché. */
  name: string;
  kind: 'automatic' | 'quartz';
  /** Alternances par heure ; 0 = balayage continu, null = quartz (1 pas/s). */
  frequencyVph: number | null;
  /** Cotes du calibre, absentes quand elles dépendent du modèle choisi. */
  diameterMm?: number;
  heightMm?: number;
  powerReserveH?: number;
  jewels?: number;
  /** Indications affichées en plus des heures, minutes et secondes. */
  calendar: 'none' | 'date' | 'day-date' | 'unknown';
  /** Position d'origine de la tige de remontoir. */
  stem?: '3h';
}

const NH3X = {
  kind: 'automatic',
  frequencyVph: 21_600,
  diameterMm: 27.4,
  heightMm: 5.32,
  powerReserveH: 41,
  jewels: 24,
  stem: '3h',
} as const;

export const MOVEMENTS: Record<string, MovementSpec> = {
  nh38: { ...NH3X, id: 'nh38', name: 'Seiko NH38A', calendar: 'none' },
  nh35: { ...NH3X, id: 'nh35', name: 'Seiko NH35A', calendar: 'date' },
  nh36: { ...NH3X, id: 'nh36', name: 'Seiko NH36A', calendar: 'day-date' },
  quartz: { id: 'quartz', name: 'Quartz', kind: 'quartz', frequencyVph: null, calendar: 'unknown' },
};

/** Pas de trotteuse par seconde : 1 pour le quartz, vib/h ÷ 3600 sinon (spec §7.2). */
export function movementStepsPerSecond(movementId: string): number {
  const movement = MOVEMENTS[movementId];
  if (!movement) return 0;
  return movement.frequencyVph === null ? 1 : movement.frequencyVph / 3600;
}
