import { expect, it } from 'vitest';
import { defaultConfig } from '../config/defaults';
import { DIAL_SIZES } from '../config/dial-size';
import { CASE_SHAPES, shapeRadius } from './case-shape';
import { DIAL_SHAPES, dialRadiusAt } from './dial-shape';
import { watchDimensions, proportionsForDiameter } from './dimensions';
import { parseCatalog } from '../catalog/load';
import rawCatalog from '../../data/catalog.json';
import { encodeConfigHash, decodeConfigHash } from '../config/url';

it.each(CASE_SHAPES)(
  '%s: every aperture size leaves a continuous metal wall on every dial shape',
  (body) => {
    for (const shape of DIAL_SHAPES)
      for (const diameter of [22, 40, 48]) {
        const radii = [];
        for (const size of DIAL_SIZES) {
          const config = defaultConfig();
          config.case.shape = body;
          config.dial.shape = shape;
          config.dial.size = size;
          Object.assign(config.case, proportionsForDiameter(diameter));
          const d = watchDimensions(config);
          radii.push(d.dialExtent);
          for (let i = 0; i < 128; i++) {
            const a = (i * Math.PI * 2) / 128;
            const aperture = d.openingRadius * d.dialScale * shapeRadius(shape, a);
            const wall = d.caseRadius * shapeRadius(body, a) - aperture;
            expect(wall, `${body}/${shape}/${diameter}/${size}`).toBeGreaterThanOrEqual(
              d.bezelWidth - 0.001,
            );
            expect(d.hands.second).toBeLessThan(dialRadiusAt(d, a));
          }
        }
        expect(radii[0]).toBeLessThan(radii[1]!);
        expect(radii[1]).toBeLessThan(radii[2]!);
      }
  },
);
it('reduces the circular tonneau aperture automatically and retains the reference round watch', () => {
  const config = defaultConfig();
  const round = watchDimensions(config);
  expect(round.openingRadius).toBe(17.4);
  expect(round.bezelWidth).toBe(2.6);
  config.case.shape = 'tonneau';
  const tonneau = watchDimensions(config);
  expect(tonneau.openingRadius).toBeLessThan(15.01);
  expect(tonneau.caseRadius * 0.88 - tonneau.openingRadius).toBeGreaterThan(2.6);
  expect(tonneau.hands.second).toBeLessThan(round.hands.second);
});
it('shares aperture size without changing any old V1 identifier or the default link', () => {
  const catalog = parseCatalog(rawCatalog);
  expect(encodeConfigHash(defaultConfig())).toBe('#v1.e30');
  expect(decodeConfigHash('#v1.e30', catalog).config.dial.size).toBe('open');
  for (const size of DIAL_SIZES) {
    const c = defaultConfig();
    c.case.shape = 'tonneau';
    c.dial.size = size;
    c.dial.color = '#ABCDEF';
    c.rehaut.profile = 'concave';
    expect(decodeConfigHash(encodeConfigHash(c), catalog)).toEqual({ config: c, notice: '' });
  }
});
