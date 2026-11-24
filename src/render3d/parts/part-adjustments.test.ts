import * as THREE from 'three';
import { expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../../core/catalog/load';
import { defaultConfig } from '../../core/config/defaults';
import { HAND_STYLES } from '../../core/config/hands';
import { BEZEL_SHAPES } from '../../core/config/bezel';
import { decodeConfigHash, encodeConfigHash } from '../../core/config/url';
import { applyVariant } from '../../core/nav/selection';
import { watchDimensions, proportionsForDiameter } from '../../core/geometry/dimensions';
import { CASE_SHAPES, shapeRadius } from '../../core/geometry/case-shape';
import { buildHands } from './hands';
import { MaterialLibrary } from '../materials';
import { buildWatch } from '../watch';

const dispose = (root: THREE.Object3D) =>
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });

it.each(HAND_STYLES)(
  '%s: adjusted hands retain finite surfaces, radial clearance and recessed inserts',
  (style) => {
    for (const diameter of [22, 48])
      for (const wide of [false, true])
        for (const luminous of [false, true]) {
          const c = defaultConfig();
          Object.assign(c.case, proportionsForDiameter(diameter));
          c.hands.hour = { style, length: wide ? 1.35 : 0.65, width: wide ? 1.8 : 0.6 };
          c.hands.minute = { style, length: wide ? 1.05 : 0.65, width: wide ? 1.8 : 0.6 };
          c.hands.lume = luminous ? 'c3' : null;
          const d = watchDimensions(c),
            lib = new MaterialLibrary(),
            h = buildHands(c, d, lib, true, false, true);
          for (const part of ['hour', 'minute'] as const) {
            const frame = h.group.getObjectByName(`${part}-blade`) as THREE.Mesh;
            for (const name of ['position', 'normal'])
              expect(
                Array.from(frame.geometry.getAttribute(name).array).every(Number.isFinite),
              ).toBe(true);
            const p = frame.geometry.getAttribute('position');
            for (let i = 0; i < p.count; i++)
              expect(Math.hypot(p.getX(i), p.getY(i))).toBeLessThan(d.dialSafeRadius * 0.995);
            if (luminous) {
              const fill = h.group.getObjectByName(`${part}-lume`) as THREE.Mesh;
              fill.geometry.computeBoundingBox();
              frame.geometry.computeBoundingBox();
              expect(fill.geometry.boundingBox!.max.z).toBeLessThan(
                frame.geometry.boundingBox!.max.z,
              );
            }
          }
          dispose(h.group);
          dispose(h.seconds);
          lib.dispose();
        }
  },
);

it('three spokes expose recessed pigment sectors and retain a metal centre', () => {
  const c = defaultConfig();
  c.hands.hour.style = 'mercedes';
  c.hands.lume = 'c3';
  const d = watchDimensions(c),
    k = d.dialSafeRadius / 20,
    lib = new MaterialLibrary(),
    h = buildHands(c, d, lib, true, false, true);
  h.group.updateMatrixWorld(true);
  const hour = [h.group.getObjectByName('hour-blade')!, h.group.getObjectByName('hour-lume')!];
  const cy = d.hands.hour * 0.66,
    r = 1.65 * k;
  const ray = new THREE.Raycaster(
    new THREE.Vector3(-r * 0.43, cy + r * 0.25, 10),
    new THREE.Vector3(0, 0, -1),
  );
  expect(ray.intersectObjects(hour)[0]?.object.name).toBe('hour-lume');
  ray.ray.origin.set(0, cy, 10);
  expect(ray.intersectObjects(hour)[0]?.object.name).toBe('hour-blade');
  dispose(h.group);
  dispose(h.seconds);
  lib.dispose();
});

it.each(CASE_SHAPES)(
  '%s: independently shaped bezels stay inside the case and outside the crystal',
  (caseShape) => {
    for (const shape of BEZEL_SHAPES)
      for (const diameter of [22, 48])
        for (const high of [false, true]) {
          const c = defaultConfig();
          Object.assign(c.case, proportionsForDiameter(diameter));
          c.case.shape = caseShape;
          c.dial.shape = high ? caseShape : 'round';
          Object.assign(c.bezel, {
            shape,
            width: high ? 1.8 : 0.7,
            height: high ? 1.6 : 1,
            finish: 'brushed',
          });
          const lib = new MaterialLibrary(),
            model = buildWatch(c, lib, { quality: 'fallback', layers: ['case', 'crystal'] });
          const ring = model.layers.case.getObjectByName('independent-bezel')!;
          expect(ring).toBeTruthy();
          const d = model.dimensions;
          expect(d.dialSafeRadius).toBeGreaterThan(0);
          ring.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            const p = o.geometry.getAttribute('position');
            expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
            expect(Array.from(o.geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(
              true,
            );
            for (let i = 0; i < p.count; i += 3) {
              const a = Math.atan2(p.getY(i), p.getX(i)),
                r = Math.hypot(p.getX(i), p.getY(i));
              expect(r).toBeLessThanOrEqual(d.caseRadius * shapeRadius(caseShape, a) + 0.001);
              const glass = (d.openingRadius + 0.25) * d.dialScale * shapeRadius(d.dialShape, a);
              expect(r - glass).toBeGreaterThan(0.005);
            }
          });
          model.setBezelAngle(90);
          expect(ring.rotation.z).toBe(0);
          expect(c.case.shape).toBe(caseShape);
          model.dispose();
          lib.dispose();
        }
  },
  20_000,
);

it('preserves legacy links and round-trips independent settings; choosing a hand set clears only the drawings', () => {
  const catalog = parseCatalog(rawCatalog),
    c = defaultConfig();
  expect(encodeConfigHash(c)).toBe('#v1.e30');
  expect(decodeConfigHash('#v1.e30', catalog)).toEqual({ config: c, notice: '' });
  c.hands.hour = { style: 'mercedes', length: 1.12, width: 1.2 };
  c.hands.minute.style = 'pencil';
  Object.assign(c.bezel, { shape: 'octagon', width: 1.2, height: 1.3, finish: 'polished' });
  expect(decodeConfigHash(encodeConfigHash(c), catalog)).toEqual({ config: c, notice: '' });
  const row = catalog.rows.find((r) => r.id === 'hands')!,
    next = applyVariant(c, row, 0);
  expect(next.hands.hour).toEqual({ style: 'match', length: 1.12, width: 1.2 });
  expect(next.hands.minute.style).toBe('match');
  expect(next.bezel).toEqual(c.bezel);
});
