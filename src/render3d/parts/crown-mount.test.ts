import * as THREE from 'three';
import { expect, it } from 'vitest';
import { CASE_SHAPES, shapeRadius } from '../../core/geometry/case-shape';
import { crownMount } from '../../core/geometry/crown-mount';
import { defaultConfig } from '../../core/config/defaults';
import {
  crownAngle,
  proportionsForDiameter,
  watchDimensions,
} from '../../core/geometry/dimensions';
import { MaterialLibrary } from '../materials';
import { buildCrown, CROWN_STYLES } from './crown';

it.each(CASE_SHAPES)('%s: crown axis is normal to the flank at every offered position', (shape) => {
  const d = watchDimensions(defaultConfig());
  for (const position of ['3h', '2h', '4h']) {
    const mount = crownMount(d, shape, position);
    const theta = crownAngle(position);
    const point = (a: number) =>
      new THREE.Vector2(Math.cos(a), Math.sin(a)).multiplyScalar(
        d.caseRadius * shapeRadius(shape, a),
      );
    const tangent = point(theta + 0.0001)
      .sub(point(theta - 0.0001))
      .normalize();
    const normal = new THREE.Vector2(Math.cos(mount.angle), Math.sin(mount.angle));
    expect(Math.abs(tangent.dot(normal))).toBeLessThan(0.00001);
    expect(mount.x + normal.x * mount.reach).toBeCloseTo(mount.contact.x, 8);
    expect(mount.y + normal.y * mount.reach).toBeCloseTo(mount.contact.y, 8);
    expect(Math.hypot(mount.x, mount.y)).toBeLessThan(
      d.caseRadius * shapeRadius(shape, Math.atan2(mount.y, mount.x)),
    );
  }
});

it.each(CASE_SHAPES)(
  '%s: all crown styles build; guards stay below the dial at small and large sizes',
  (shape) => {
    const lib = new MaterialLibrary();
    for (const diameter of [22, 48])
      for (const position of ['3h', '2h', '4h'])
        for (const style of CROWN_STYLES) {
          const config = defaultConfig();
          config.case.shape = shape;
          config.dial.shape = shape;
          config.crown.position = position;
          config.crown.style = style;
          Object.assign(config.case, proportionsForDiameter(diameter));
          const d = watchDimensions(config);
          const group = buildCrown(config, d, lib, true);
          group.updateMatrixWorld(true);
          group.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            const p = o.geometry.getAttribute('position');
            expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
            if (o.parent === group) {
              const v = new THREE.Vector3();
              for (let i = 0; i < p.count; i += 11) {
                v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
                expect(v.z).toBeLessThanOrEqual(-0.149);
              }
            }
            o.geometry.dispose();
          });
        }
    lib.dispose();
  },
  20000,
);
