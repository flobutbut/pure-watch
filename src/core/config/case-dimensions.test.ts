import { describe, expect, it } from 'vitest';
import { snapToStops, STRAP_WIDTHS_MM } from './case-dimensions';

describe('aimantation des curseurs de dimensions', () => {
  it('pose la valeur sur l’arrêt le plus proche, dans la tolérance seulement', () => {
    expect(snapToStops(19.8, [18, 20, 22], 0.4)).toBe(20);
    expect(snapToStops(19.5, [18, 20, 22], 0.4)).toBe(19.5);
    expect(snapToStops(40.3, [40], 0.4)).toBe(40);
    expect(snapToStops(41, [], 0.4)).toBe(41);
  });

  it('choisit le plus proche quand deux arrêts sont à portée', () => {
    expect(snapToStops(18.6, [18, 19], 0.5)).toBe(19);
    expect(snapToStops(18.4, [18, 19], 0.5)).toBe(18);
  });

  it('propose les largeurs de bracelet du commerce, dans les bornes du curseur', () => {
    expect(STRAP_WIDTHS_MM).toContain(20);
    expect(STRAP_WIDTHS_MM).toContain(19);
    expect(Math.min(...STRAP_WIDTHS_MM)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...STRAP_WIDTHS_MM)).toBeLessThanOrEqual(30);
  });
});
