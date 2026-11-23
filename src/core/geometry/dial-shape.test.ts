import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../config/defaults';
import { encodeConfigHash, decodeConfigHash } from '../config/url';
import { parseCatalog } from '../catalog/load';
import rawCatalog from '../../data/catalog.json';
import { CASE_SHAPES, shapeRadius } from './case-shape';
import { DIAL_SHAPES, dialRadiusAt } from './dial-shape';
import { watchDimensions, proportionsForDiameter } from './dimensions';

const catalog = parseCatalog(rawCatalog);

describe('dial contours', () => {
  it('places shape and aperture rows before dial finish and exposes all six shapes', () => {
    const i = catalog.rows.findIndex((row) => row.id === 'dial-shape');
    expect(catalog.rows[i + 1]!.id).toBe('dial-size');
    expect(catalog.rows[i + 2]!.id).toBe('dial-finish');
    expect(catalog.rows[i]!.variants.map((v) => v.value)).toEqual([...DIAL_SHAPES]);
  });

  it.each(CASE_SHAPES)(
    '%s: all dials fit with a metal wall and rotating-hand clearance',
    (caseShape) => {
      for (const diameter of [22, 40, 48])
        for (const shape of DIAL_SHAPES) {
          const config = defaultConfig();
          config.case.shape = caseShape;
          config.dial.shape = shape;
          Object.assign(config.case, proportionsForDiameter(diameter));
          const d = watchDimensions(config);
          for (let i = 0; i < 1536; i++) {
            const theta = (i * Math.PI * 2) / 1536;
            const opening = d.openingRadius * d.dialScale * shapeRadius(shape, theta);
            const wall = d.caseRadius * shapeRadius(caseShape, theta) - opening;
            expect(wall, `${caseShape}/${shape}/${diameter}`).toBeGreaterThanOrEqual(
              d.bezelWidth - 0.001,
            );
            expect(d.hands.second).toBeLessThan(dialRadiusAt(d, theta));
            expect(dialRadiusAt(d, theta)).toBeLessThanOrEqual(d.dialExtent + 1e-6);
          }
        }
    },
  );

  it('keeps old circular dimensions and old URLs unchanged', () => {
    const config = defaultConfig();
    const d = watchDimensions(config);
    expect(d.dialSafeRadius).toBe(d.dialRadius);
    expect(d.dialExtent).toBe(d.dialRadius);
    expect(d.dialScale).toBe(1);
    expect(encodeConfigHash(config)).toBe('#v1.e30');
    expect(decodeConfigHash('#v1.e30', catalog).config.dial.shape).toBe('round');
  });

  it.each(DIAL_SHAPES)(
    '%s is restored by the share link without reinterpreting old wire identifiers',
    (shape) => {
      const config = defaultConfig();
      config.dial.shape = shape;
      expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
    },
  );
});
