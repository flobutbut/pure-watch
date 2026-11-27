import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../core/config/defaults';
import { cushionPilot } from '../core/config/pilot';
import { CASE_SHAPES } from '../core/geometry/case-shape';
import { proportionsForDiameter, watchDimensions } from '../core/geometry/dimensions';
import { handAngles } from '../core/clock/angles';
import { MaterialLibrary } from './materials';
import { buildWatch, type WatchModel } from './watch';
import { buildHands, HAND_SETS } from './parts/hands';
import { buildCrystal } from './parts/crystal';
import { LUG_STYLES } from './parts/lugs';
import { geometrySignature } from './geometry-test-utils';

const layers = ['case', 'rehaut', 'lugs', 'crown'] as const;
function fingerprint(model: WatchModel) {
  return geometrySignature(model.root, ['position', 'normal', 'uv', 'color']);
}
function dispose(object: THREE.Object3D) {
  object.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}

describe('common envelope render modes', () => {
  it.each([...CASE_SHAPES.filter((s) => s !== 'cushion'), 'asymmetric'])(
    '%s shares the envelope in geometry and refined modes, preserving the legacy dimensions',
    (shape) => {
      const config = defaultConfig();
      config.case.shape = shape;
      const lib = new MaterialLibrary();
      const before = buildWatch(config, lib, { quality: 'fallback', refinement: 'legacy', layers });
      const after = buildWatch(config, lib, { quality: 'fallback', refinement: 'refined', layers });
      const geometry = buildWatch(config, lib, {
        quality: 'fallback',
        refinement: 'geometry',
        layers,
      });
      expect(fingerprint(after)).toBe(fingerprint(geometry));
      expect(fingerprint(after)).not.toBe(fingerprint(before));
      expect(after.dimensions).toEqual(before.dimensions);
      before.dispose();
      after.dispose();
      geometry.dispose();
      lib.dispose();
    },
  );

  it.each(LUG_STYLES)('preserves %s option and configuration at 22 / 40 / 48 mm', (lugs) => {
    for (const diameter of [22, 40, 48]) {
      const config = cushionPilot();
      config.case.lugs = lugs;
      Object.assign(config.case, proportionsForDiameter(diameter));
      const original = structuredClone(config);
      const lib = new MaterialLibrary();
      const model = buildWatch(config, lib, { quality: 'fallback', layers });
      expect(config).toEqual(original);
      expect(model.dimensions).toEqual(watchDimensions(config));
      model.root.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const p = o.geometry.getAttribute('position');
        expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
        const tangents = o.geometry.getAttribute('tangent');
        if (tangents)
          for (let i = 0; i < tangents.count; i++) {
            expect(Math.hypot(tangents.getX(i), tangents.getY(i), tangents.getZ(i))).toBeCloseTo(
              1,
              4,
            );
          }
        for (const group of o.geometry.groups)
          expect(group.start + group.count).toBeLessThanOrEqual(o.geometry.index?.count ?? p.count);
      });
      if (lugs === 'none') expect(model.layers.lugs.children).toHaveLength(0);
      model.dispose();
      lib.dispose();
    }
  });
});

describe('hand and crystal clearances', () => {
  it.each([22, 40, 48])(
    '%i mm: all hand sets remain separated throughout their rotation',
    (diameter) => {
      for (const set of HAND_SETS) {
        const config = cushionPilot();
        Object.assign(config.case, proportionsForDiameter(diameter));
        config.hands.set = set;
        const lib = new MaterialLibrary();
        const hands = buildHands(config, watchDimensions(config), lib, true, false, true);
        for (const seconds of [0, 17.5, 35, 59.9]) {
          hands.setAngles(handAngles({ h: 10, m: 10, s: seconds }, 0));
          hands.group.updateMatrixWorld(true);
          hands.seconds.updateMatrixWorld(true);
          const hour = new THREE.Box3().setFromObject(hands.group.getObjectByName('hour-blade')!);
          const minute = new THREE.Box3().setFromObject(
            hands.group.getObjectByName('minute-blade')!,
          );
          const second = new THREE.Box3().setFromObject(
            hands.seconds.getObjectByName('second-blade')!,
          );
          expect(minute.min.z - hour.max.z).toBeGreaterThan(0.045);
          expect(second.min.z - minute.max.z).toBeGreaterThan(0.045);
        }
        dispose(hands.group);
        dispose(hands.seconds);
        lib.dispose();
      }
    },
  );

  it.each(['sapphire-flat', 'sapphire-domed', 'sapphire-box', 'mineral', 'acrylic'])(
    '%s: closed underside stays above the moving parts at all catalog sizes',
    (type) => {
      for (const diameter of [22, 40, 48]) {
        const config = cushionPilot();
        config.crystal.type = type;
        Object.assign(config.case, proportionsForDiameter(diameter));
        const d = watchDimensions(config);
        const lib = new MaterialLibrary();
        const crystal = buildCrystal(config, d, lib, 'fallback', true);
        const hands = buildHands(config, d, lib, true, false, true);
        const root = new THREE.Group();
        root.add(hands.group, hands.seconds);
        root.updateMatrixWorld(true);
        crystal.updateMatrixWorld(true);
        const ray = new THREE.Raycaster();
        // Only upper vertices: this also covers the distinctive ring and counterweight.
        root.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          const p = o.geometry.getAttribute('position');
          for (let i = 0; i < p.count; i += 3) {
            const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
            ray.set(new THREE.Vector3(v.x + 1e-6, v.y + 2e-6, -20), new THREE.Vector3(0, 0, 1));
            const hit = ray.intersectObject(crystal.children[0]!)[0];
            expect(
              hit,
              `closed glass underside: ${type}, ${diameter} mm, ${o.name}, vertex ${v.toArray()}`,
            ).toBeDefined();
            expect(hit!.point.z - v.z).toBeGreaterThan(0.03);
          }
        });
        dispose(crystal);
        dispose(root);
        lib.dispose();
      }
    },
    // Lancer de rayons sur chaque sommet de trois tailles : calcul lourd, qui frôlait la
    // limite de 5 s par défaut et échouait par intermittence.
    20_000,
  );
});
