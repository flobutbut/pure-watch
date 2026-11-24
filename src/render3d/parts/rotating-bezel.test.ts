import * as THREE from 'three';
import { expect, it } from 'vitest';
import { defaultConfig } from '../../core/config/defaults';
import { bezelAngle, turnBezel } from '../../core/config/bezel';
import { CASE_PROFILES } from '../../core/config/case-profile';
import { CASE_SHAPES } from '../../core/geometry/case-shape';
import { proportionsForDiameter } from '../../core/geometry/dimensions';
import { MaterialLibrary } from '../materials';
import { buildWatch } from '../watch';
import { rotatingBezelDimensions } from './rotating-bezel';

it('snaps at three degrees, wraps and respects the diving ratchet', () => {
  expect(bezelAngle(-3)).toBe(357);
  expect(bezelAngle(362)).toBe(3);
  expect(bezelAngle(NaN)).toBe(0);
  const config = defaultConfig();
  expect(turnBezel(config, 3)).toBe(0);
  expect(turnBezel(config, -3)).toBe(357);
  config.bezel.scale = '24h';
  expect(turnBezel(config, 3)).toBe(3);
});

it.each(
  CASE_SHAPES.flatMap(
    (shape) =>
      [
        [shape, 'rotating'],
        [shape, 'fixed-scale'],
      ] as const,
  ),
)(
  '%s / %s: a circular ring clears the glass and fits the case at every aperture and profile',
  (shape, type) => {
    const lib = new MaterialLibrary();
    for (const diameter of [22, 48])
      for (const size of ['compact', 'balanced', 'open'])
        for (const profile of CASE_PROFILES) {
          const config = defaultConfig();
          Object.assign(config.case, proportionsForDiameter(diameter), { shape, profile });
          config.dial.shape = shape;
          config.dial.size = size;
          config.bezel.type = type;
          config.bezel.angleDeg = 42;
          const model = buildWatch(config, lib, {
            quality: 'fallback',
            layers: ['case', 'rehaut', 'crystal'],
          });
          const d = model.dimensions;
          expect(d.dialShape).toBe('round');
          expect(config.dial.shape).toBe(shape);
          const ring = model.layers.case.getObjectByName(
            type === 'rotating' ? 'rotating-bezel' : 'fixed-bezel',
          )!;
          expect(ring).toBeTruthy();
          expect(ring.rotation.z).toBeCloseTo(type === 'rotating' ? (-42 * Math.PI) / 180 : 0);
          const { outer, inner, insertInner, insertOuter, bottom, top } = rotatingBezelDimensions(
            config,
            d,
          );
          expect(insertOuter - insertInner).toBeGreaterThan(0.7);
          let glassRadius = 0;
          model.layers.crystal.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            const p = o.geometry.getAttribute('position');
            for (let i = 0; i < p.count; i++)
              glassRadius = Math.max(glassRadius, Math.hypot(p.getX(i), p.getY(i)));
          });
          expect(inner - glassRadius).toBeGreaterThan(0.03);
          expect(bottom).toBeLessThan(top);
          ring.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            const p = o.geometry.getAttribute('position');
            for (let i = 0; i < p.count; i++) {
              const r = Math.hypot(p.getX(i), p.getY(i));
              expect(r).toBeGreaterThanOrEqual(inner - 0.00001);
              expect(r).toBeLessThanOrEqual(outer + 0.00001);
            }
          });
          model.root.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            for (const name of ['position', 'normal'])
              expect(Array.from(o.geometry.getAttribute(name).array).every(Number.isFinite)).toBe(
                true,
              );
          });
          const glass = model.layers.crystal.quaternion.toArray();
          const base = model.layers.case.children
            .filter((o) => o !== ring)
            .map((o) => o.quaternion.toArray());
          model.setBezelAngle(153);
          expect(ring.rotation.z).toBeCloseTo(type === 'rotating' ? (-153 * Math.PI) / 180 : 0);
          expect(model.layers.crystal.quaternion.toArray()).toEqual(glass);
          expect(
            model.layers.case.children.filter((o) => o !== ring).map((o) => o.quaternion.toArray()),
          ).toEqual(base);
          model.dispose();
        }
    lib.dispose();
  },
  20_000,
);
