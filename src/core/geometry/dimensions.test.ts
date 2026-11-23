import { describe, expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { defaultConfig } from '../config/defaults';
import { applyVariant } from '../nav/selection';
import { crownAngle, proportionsForDiameter, watchDimensions } from './dimensions';

describe('dimensions', () => {
  it('40 mm : cadran plus petit que le boîtier, aiguilles plus courtes que le cadran', () => {
    const d = watchDimensions(defaultConfig());
    expect(d.caseRadius).toBe(20);
    expect(d.dialRadius).toBeLessThan(d.openingRadius);
    expect(d.openingRadius).toBeLessThan(d.caseRadius);
    expect(d.hands.hour).toBeLessThan(d.hands.minute);
    expect(d.hands.second).toBeLessThan(d.dialRadius);
    expect(d.z.back).toBeLessThan(0);
    expect(d.z.crystalTop).toBeGreaterThan(d.z.bezelTop);
    expect(d.z.crystalTop - d.z.back).toBeCloseTo(d.caseThickness, 0);
  });

  it('les cornes dépassent du boîtier pour toutes les tailles du catalogue', () => {
    const catalog = parseCatalog(rawCatalog);
    const sizes = catalog.rows.find((row) => row.id === 'case-size')!;
    sizes.variants.forEach((_, i) => {
      const d = watchDimensions(applyVariant(defaultConfig(), sizes, i));
      expect(d.lugToLug / 2).toBeGreaterThan(d.caseRadius);
      expect(d.lugWidth).toBeLessThan(d.caseRadius * 2);
      expect(d.lugWidth % 2).toBe(0);
    });
  });

  it('les variantes de taille suivent proportionsForDiameter', () => {
    const catalog = parseCatalog(rawCatalog);
    const sizes = catalog.rows.find((row) => row.id === 'case-size')!;
    for (const variant of sizes.variants) {
      const value = variant.value as { diameterMm: number };
      expect(value).toEqual(proportionsForDiameter(value.diameterMm));
    }
    expect(proportionsForDiameter(40)).toEqual({
      diameterMm: 40,
      lugToLugMm: 47,
      lugWidthMm: 20,
      thicknessMm: 11,
    });
  });
});

describe('crownAngle', () => {
  it('3 h = 0, 4 h en dessous, 2 h au-dessus', () => {
    expect(crownAngle('3h')).toBe(0);
    expect(crownAngle('4h')).toBeCloseTo(-Math.PI / 6);
    expect(crownAngle('2h')).toBeCloseTo(Math.PI / 6);
    expect(crownAngle('n/a')).toBe(0);
  });
});

describe('formes de boîtier', () => {
  it('le rond vaut 1 partout, les autres débordent ou rentrent selon la forme', async () => {
    const { shapeRadius } = await import('./case-shape');
    expect(shapeRadius('round', 1.2)).toBe(1);
    expect(shapeRadius('cushion', Math.PI / 4)).toBeGreaterThan(1.05); // coins pleins
    expect(shapeRadius('tonneau', Math.PI / 2)).toBeGreaterThan(shapeRadius('tonneau', 0)); // allongé
    expect(shapeRadius('octagon', Math.PI / 8)).toBeGreaterThan(shapeRadius('octagon', 0)); // angles
    expect(shapeRadius('rectangle', 0)).toBeLessThan(1);
  });
});
