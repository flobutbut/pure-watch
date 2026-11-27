import * as THREE from 'three';
import { expect, it } from 'vitest';
import { defaultConfig } from '../../core/config/defaults';
import { DIAL_SIZES } from '../../core/config/dial-size';
import { CASE_SHAPES } from '../../core/geometry/case-shape';
import { DIAL_SHAPES } from '../../core/geometry/dial-shape';
import { proportionsForDiameter, watchDimensions } from '../../core/geometry/dimensions';
import { MaterialLibrary } from '../materials';
import { buildWatch } from '../watch';
it.each(CASE_SHAPES)(
  '%s: changing the aperture retains the lower case, lugs and crown positions',
  (shape) => {
    const lib = new MaterialLibrary();
    let reference: number[] | undefined;
    const ray = new THREE.Raycaster();
    for (const size of DIAL_SIZES) {
      const config = defaultConfig();
      config.case.shape = shape;
      config.dial.size = size;
      const d = watchDimensions(config);
      const model = buildWatch(config, lib, {
        quality: 'fallback',
        layers: ['case', 'lugs', 'crown'],
      });
      const points: number[] = [];
      model.root.updateMatrixWorld(true);
      // Compare the exterior, independently of how the inner cavity is tessellated
      // around the newly sized aperture in the common closed envelope.
      for (const level of [0.2, 0.4, 0.6])
        for (let i = 0; i < 32; i++) {
          const angle = ((i + 0.23) * Math.PI * 2) / 32;
          const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
          ray.set(
            direction
              .clone()
              .multiplyScalar(d.caseRadius * 3)
              .setZ(d.z.back + level * d.caseThickness),
            direction.clone().negate(),
          );
          const hit = ray.intersectObject(model.root, true)[0];
          expect(hit).toBeDefined();
          points.push(hit!.distance);
        }
      const crown = model.root.getObjectByName('crown')!;
      points.push(...crown.position.toArray(), crown.rotation.z);
      if (reference === undefined) reference = points;
      else points.forEach((p, i) => expect(p).toBeCloseTo(reference![i]!, 2));
      model.dispose();
    }
    lib.dispose();
  },
);
it.each(CASE_SHAPES)(
  '%s: every dial contour and aperture size builds finite geometry',
  (shape) => {
    const lib = new MaterialLibrary();
    for (const dial of DIAL_SHAPES)
      for (const size of DIAL_SIZES) {
        const config = defaultConfig();
        config.case.shape = shape;
        config.dial.shape = dial;
        config.dial.size = size;
        Object.assign(config.case, proportionsForDiameter(size === 'compact' ? 22 : 48));
        const model = buildWatch(config, lib, {
          quality: 'fallback',
          layers: ['case', 'rehaut', 'crystal', 'hands', 'seconds'],
        });
        model.root.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          expect(Array.from(o.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(
            true,
          );
          expect(Array.from(o.geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(
            true,
          );
        });
        model.dispose();
      }
    lib.dispose();
  },
  20_000,
);
