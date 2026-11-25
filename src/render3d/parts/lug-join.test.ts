import * as THREE from 'three';
import { expect, it } from 'vitest';
import { defaultConfig } from '../../core/config/defaults';
import { CASE_SHAPES, shapeRadius } from '../../core/geometry/case-shape';
import { CASE_PROFILES } from '../../core/config/case-profile';
import { proportionsForDiameter, watchDimensions } from '../../core/geometry/dimensions';
import { caseDeckTop } from './levels';
import { lugRoot } from './occlusion';
import { MaterialLibrary } from '../materials';
import { buildWatch } from '../watch';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../../core/catalog/load';
import { decodeConfigHash, encodeConfigHash } from '../../core/config/url';

it.each(
  CASE_SHAPES.flatMap(
    (s) =>
      [
        [s, 'flush'],
        [s, 'blended'],
      ] as const,
  ),
)(
  '%s/%s: flush roots, finite geometry and clearance from the aperture',
  (shape, join) => {
    for (const diameter of [22, 48])
      for (const profile of CASE_PROFILES)
        for (const lugs of ['straight', 'curved', 'integrated']) {
          const c = defaultConfig();
          Object.assign(c.case, proportionsForDiameter(diameter), {
            shape,
            profile,
            lugs,
            lugJoin: join,
          });
          c.dial.shape = shape;
          const d = watchDimensions(c),
            lib = new MaterialLibrary(),
            model = buildWatch(c, lib, { quality: 'fallback', layers: ['case', 'lugs'] });
          expect(lugRoot(d, c).top).toBe(caseDeckTop(d));
          let count = 0,
            max = -Infinity,
            clearance = Infinity;
          model.layers.lugs.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            count++;
            for (const name of ['position', 'normal'])
              expect(Array.from(o.geometry.getAttribute(name).array).every(Number.isFinite)).toBe(
                true,
              );
            const p = o.geometry.getAttribute('position');
            for (let i = 0; i < p.count; i++) {
              const x = p.getX(i),
                y = p.getY(i),
                z = p.getZ(i),
                r = Math.hypot(x, y),
                a = Math.atan2(y, x);
              max = Math.max(max, z);
              clearance = Math.min(
                clearance,
                r - (d.openingRadius + 0.25) * d.dialScale * shapeRadius(d.dialShape, a),
              );
            }
          });
          expect(count).toBeGreaterThan(0);
          expect(max).toBeLessThanOrEqual(caseDeckTop(d) + 0.001);
          expect(max).toBeGreaterThan(caseDeckTop(d) - 0.05);
          expect(clearance).toBeGreaterThan(0.005);
          model.dispose();
          lib.dispose();
        }
  },
  30_000,
);
it('keeps the default link and shares the optional connection without replacing the chosen lug style', () => {
  const c = defaultConfig(),
    catalog = parseCatalog(rawCatalog);
  expect(encodeConfigHash(c)).toBe('#2');
  expect(decodeConfigHash('#v1.e30', catalog)).toEqual({ config: c, notice: '' });
  c.case.lugs = 'drilled';
  c.case.lugJoin = 'blended';
  expect(decodeConfigHash(encodeConfigHash(c), catalog)).toEqual({ config: c, notice: '' });
});

it('keeps the interiors of broad blended root faces out of the glass opening', () => {
  const c = defaultConfig();
  c.case.lugJoin = 'blended';
  c.bezel.type = 'coin';
  c.crystal.type = 'sapphire-box';
  const d = watchDimensions(c),
    lib = new MaterialLibrary(),
    model = buildWatch(c, lib, { quality: 'fallback', layers: ['case', 'lugs'] });
  let clearance = Infinity;
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    v = new THREE.Vector3(),
    p = new THREE.Vector3();
  model.layers.lugs.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const positions = o.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i += 3) {
      a.fromBufferAttribute(positions, i);
      b.fromBufferAttribute(positions, i + 1);
      v.fromBufferAttribute(positions, i + 2);
      for (let j = 0; j <= 4; j++)
        for (let k = 0; k <= 4 - j; k++) {
          p.copy(a)
            .multiplyScalar(j / 4)
            .addScaledVector(b, k / 4)
            .addScaledVector(v, 1 - (j + k) / 4);
          const opening =
            (d.openingRadius + 0.25) * d.dialScale * shapeRadius(d.dialShape, Math.atan2(p.y, p.x));
          clearance = Math.min(clearance, Math.hypot(p.x, p.y) - opening);
        }
    }
  });
  expect(clearance).toBeGreaterThan(0.005);
  model.dispose();
  lib.dispose();
});
