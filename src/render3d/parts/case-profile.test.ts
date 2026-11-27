import * as THREE from 'three';
import { expect, it } from 'vitest';
import { defaultConfig } from '../../core/config/defaults';
import { CASE_PROFILES } from '../../core/config/case-profile';
import { CASE_SHAPES } from '../../core/geometry/case-shape';
import { proportionsForDiameter, watchDimensions } from '../../core/geometry/dimensions';
import { MaterialLibrary } from '../materials';
import { buildWatch } from '../watch';
import { profileAttachmentSurface } from './case-profile';
import { lugRoot } from './occlusion';
import { buildCushionCase } from './cushion-case';

function positions(group: THREE.Object3D) {
  const result: number[] = [];
  group.traverse((o) => {
    if (o instanceof THREE.Mesh)
      for (const value of o.geometry.getAttribute('position').array) result.push(value);
  });
  return result;
}

it.each(CASE_SHAPES)('%s: upper curvature preserves the aperture and dimensions', (shape) => {
  const lib = new MaterialLibrary();
  const config = defaultConfig();
  config.case.shape = shape;
  config.dial.shape = shape;
  config.bezel.type = 'stepped';
  let reference: { dimensions: unknown; rehaut: number[]; crystal: number[] } | undefined;
  const signatures = new Set<string>();
  for (const dome of [0, 0.5, 1]) {
    config.case.construction!.dome = dome;
    const model = buildWatch(config, lib, {
      quality: 'fallback',
      layers: ['case', 'rehaut', 'crystal'],
    });
    signatures.add(JSON.stringify(positions(model.layers.case)));
    const actual = {
      dimensions: model.dimensions,
      rehaut: positions(model.layers.rehaut),
      crystal: positions(model.layers.crystal),
    };
    if (reference) expect(actual).toEqual(reference);
    else reference = actual;
    model.dispose();
  }
  expect(signatures.size).toBe(3);
  config.case.profile = 'curved';
  const original = buildWatch(config, lib, { quality: 'fallback', layers: ['case'] });
  config.case.profile = 'future-unknown';
  const fallback = buildWatch(config, lib, { quality: 'fallback', layers: ['case'] });
  expect(positions(fallback.root)).toEqual(positions(original.root));
  original.dispose();
  fallback.dispose();
  lib.dispose();
});

it.each(CASE_SHAPES)(
  '%s: historical attachments stay buried in the legacy case at both size extremes',
  (shape) => {
    const lib = new MaterialLibrary();
    const ray = new THREE.Raycaster();
    for (const diameter of [22, 48])
      for (const profile of CASE_PROFILES) {
        const config = defaultConfig();
        Object.assign(config.case, proportionsForDiameter(diameter), { shape, profile });
        config.crown.style = 'guarded';
        config.crown.position = '2h';
        const d = watchDimensions(config);
        const model = buildWatch(config, lib, {
          quality: 'fallback',
          refinement: 'legacy',
          layers: ['case', 'lugs', 'crown'],
        });
        const historicalCase =
          shape === 'cushion' ? buildCushionCase(config, d, lib).case : model.layers.case;
        model.root.updateMatrixWorld(true);
        model.root.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          for (const name of ['position', 'normal', 'tangent']) {
            const attribute = o.geometry.getAttribute(name);
            if (attribute) expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
          }
        });
        if (profile !== 'curved') {
          const { bottom, top } = lugRoot(d);
          const surface = profileAttachmentSurface(config, d, bottom, top);
          for (const z of [bottom, (bottom + top) / 2, top])
            for (let i = 0; i < 16; i++) {
              const angle = ((i + 0.17) / 16) * Math.PI * 2;
              const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
              ray.set(
                direction
                  .clone()
                  .multiplyScalar(d.caseRadius * 2)
                  .setZ(z),
                direction.clone().negate(),
              );
              const hit = ray.intersectObject(historicalCase, true)[0];
              const context = `${shape}, ${diameter} mm, ${profile}, z=${z}, angle=${angle}`;
              expect(hit, context).toBeDefined();
              const depth = Math.hypot(hit!.point.x, hit!.point.y) - surface(angle);
              expect(depth, context).toBeGreaterThan(0.02);
              expect(depth, context).toBeLessThan(2);
            }
        }
        if (historicalCase !== model.layers.case)
          historicalCase.traverse((o) => {
            if (o instanceof THREE.Mesh) o.geometry.dispose();
          });
        model.dispose();
      }
    lib.dispose();
  },
  20_000,
);
