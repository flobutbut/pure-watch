import * as THREE from 'three';
import { expect, it } from 'vitest';
import { defaultConfig } from '../../core/config/defaults';
import { LUG_JOINS } from '../../core/config/lugs';
import { CASE_SHAPES, shapeRadius } from '../../core/geometry/case-shape';
import { proportionsForDiameter, watchDimensions } from '../../core/geometry/dimensions';
import { MaterialLibrary } from '../materials';
import { buildLugs, LUG_STYLES } from './lugs';

const samples = [
  [1, 0],
  [0, 1],
  [0, 0],
  [0.5, 0.5],
  [0.5, 0],
  [0, 0.5],
  [1 / 3, 1 / 3],
];

it.each(CASE_SHAPES)(
  '%s: every lug style clears the dial and the strap opening',
  (shape) => {
    const lib = new MaterialLibrary();
    const failures: string[] = [];
    for (const [diameter, profile, dialShape] of [
      [22, 'curved', 'round'],
      [40, 'faceted', shape],
      [48, 'stepped', 'round'],
      [40, 'straight', shape],
    ] as const) {
      for (const style of LUG_STYLES)
        for (const join of LUG_JOINS) {
          const config = defaultConfig();
          Object.assign(config.case, proportionsForDiameter(diameter), {
            shape,
            profile,
            lugs: style,
            lugJoin: join,
          });
          config.dial.shape = dialShape;
          const d = watchDimensions(config);
          const group = buildLugs(config, d, lib, shape === 'cushion');
          let intrusion = 0,
            bridge = 0,
            finite = true;
          const a = new THREE.Vector3(),
            b = new THREE.Vector3(),
            c = new THREE.Vector3(),
            p = new THREE.Vector3();
          group.updateMatrixWorld(true);
          group.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            for (const name of ['position', 'normal'])
              finite &&= o.geometry.getAttribute(name).array.every(Number.isFinite);
            const pos = o.geometry.getAttribute('position');
            const index = o.geometry.index;
            const count = index?.count ?? pos.count;
            for (let i = 0; i < count; i += 3) {
              for (const [v, offset] of [
                [a, 0],
                [b, 1],
                [c, 2],
              ] as const)
                v.fromBufferAttribute(
                  pos,
                  index ? index.getX(i + offset) : i + offset,
                ).applyMatrix4(o.matrixWorld);
              for (const [u, v] of samples) {
                p.copy(a)
                  .multiplyScalar(u!)
                  .addScaledVector(b, v!)
                  .addScaledVector(c, 1 - u! - v!);
                const r = Math.hypot(p.x, p.y),
                  angle = Math.atan2(p.y, p.x);
                if (p.z >= 0) {
                  const aperture =
                    (d.openingRadius + 0.1) * d.dialScale * shapeRadius(d.dialShape, angle);
                  intrusion = Math.max(intrusion, aperture - r);
                }
                if (
                  style !== 'integrated' &&
                  Math.abs(p.x) < d.lugWidth * 0.35 &&
                  Math.abs(p.y) > d.caseRadius * 0.6
                )
                  bridge = Math.max(bridge, r - d.caseRadius * shapeRadius(shape, angle));
              }
            }
          });
          if (!finite || intrusion > 0.01 || bridge > 0.05)
            failures.push(
              `${style}/${join}/${diameter}/${profile}/${dialShape}: finite=${finite}, dial=${intrusion.toFixed(2)}, bridge=${bridge.toFixed(2)}`,
            );
          if (style === 'none') expect(group.children).toHaveLength(0);
          const geometries = new Set<THREE.BufferGeometry>();
          group.traverse((o) => {
            if (o instanceof THREE.Mesh) geometries.add(o.geometry);
          });
          geometries.forEach((g) => g.dispose());
        }
    }
    lib.dispose();
    expect(failures).toEqual([]);
  },
  60_000,
);
