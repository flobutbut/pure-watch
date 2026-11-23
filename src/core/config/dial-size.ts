/** Reference opening ratios before fitting the chosen case contour. */
export const DIAL_SIZES = ['compact', 'balanced', 'open'] as const;
export function dialOpeningFactor(size: string | undefined): number {
  return size === 'compact' ? 0.88 : size === 'balanced' ? 0.94 : 1;
}
