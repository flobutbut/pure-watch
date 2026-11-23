/** Fiches minimales des mouvements (spec §7). Complétées au jalon 4. */
export interface MovementSpec {
  id: string;
  /** Alternances par heure ; 0 = balayage continu, null = quartz (1 pas/s). */
  frequencyVph: number | null;
}

export const MOVEMENTS: Record<string, MovementSpec> = {
  quartz: { id: 'quartz', frequencyVph: null },
  nh35: { id: 'nh35', frequencyVph: 21_600 },
  nh36: { id: 'nh36', frequencyVph: 21_600 },
  nh38: { id: 'nh38', frequencyVph: 21_600 },
};

/** Pas de trotteuse par seconde : 1 pour le quartz, vib/h ÷ 3600 sinon (spec §7.2). */
export function movementStepsPerSecond(movementId: string): number {
  const movement = MOVEMENTS[movementId];
  if (!movement) return 0;
  return movement.frequencyVph === null ? 1 : movement.frequencyVph / 3600;
}
