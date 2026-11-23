import { describe, expect, it } from 'vitest';
import { deltaE2000 } from './delta-e';
import { nearestRal, RAL_CLASSIC } from './ral';

describe('écart de couleur CIEDE2000', () => {
  // Paires de référence de Sharma, Wu & Dalal (2005).
  it.each([
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
    [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[90.8027, -2.0831, 1.441], [91.1528, -1.6435, 0.0447], 1.4441],
  ] as const)('%j / %j → %d', (a, b, expected) => {
    expect(deltaE2000(a, b)).toBeCloseTo(expected, 3);
  });
});

describe('nuancier RAL', () => {
  it('liste des codes uniques, sans les teintes fluorescentes', () => {
    const codes = RAL_CLASSIC.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).not.toContain('1026');
    expect(RAL_CLASSIC.every((c) => /^#[\dA-F]{6}$/.test(c.hex) && c.name.length > 0)).toBe(true);
  });

  it('retrouve une teinte du nuancier et sa voisine', () => {
    expect(nearestRal('#2A3756')).toMatchObject({ ral: { code: '5003', name: 'Bleu saphir' } });
    expect(nearestRal('#0B0B0E')?.ral.code).toBe('9005');
  });

  it('refuse une teinte sans équivalent crédible', () => {
    expect(nearestRal('#FF00FF')).toBeNull();
    expect(nearestRal('pas une couleur')).toBeNull();
  });
});

describe('nom des teintes', () => {
  it('garde le nom du catalogue et nomme une couleur libre d’après le RAL', async () => {
    const { tint } = await import('./names');
    expect(tint('#1e3a6b').name).toBe('Bleu nuit');
    expect(tint('#2A3756')).toMatchObject({ name: 'Bleu saphir', ral: { code: '5003' } });
    expect(tint('#FF00FF')).toEqual({ name: 'Teinte personnalisée', ral: undefined });
  });
});
