import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { blackTonneauPilot, cushionPilot } from '../core/config/pilot';
import { watchDimensions, proportionsForDiameter } from '../core/geometry/dimensions';
import { MaterialLibrary } from './materials';
import { buildWatch, type WatchModel } from './watch';
import { buildHands, HAND_SETS } from './parts/hands';
import { beveledBaton } from './parts/profile';
import { geometrySignature } from './geometry-test-utils';

function dispose(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}
function positions(model: WatchModel) {
  return geometrySignature(model.root);
}
const layers = ['case', 'rehaut', 'crown'] as const;

describe('black ceramic tonneau', () => {
  it('keeps the baton silhouette, with a finite closed chamfer and two finish groups', () => {
    const geometry = beveledBaton(16, 2, 0.4, 0.16);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.min.x).toBeCloseTo(-0.4);
    expect(box.max.x).toBeCloseTo(0.4);
    expect(box.min.y).toBeCloseTo(-2);
    expect(box.max.y).toBeCloseTo(16);
    expect(box.min.z).toBeCloseTo(0);
    expect(box.max.z).toBeCloseTo(0.16);
    expect(geometry.groups.map((g) => g.materialIndex)).toEqual([0, 1]);
    expect(Array.from(geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
    geometry.dispose();
  });

  it('isolates ceramic satin finishes in the shared material cache', () => {
    const lib = new MaterialLibrary();
    const black = blackTonneauPilot();
    const cushion = cushionPilot();
    cushion.case.material = 'ceramic';
    const satin = lib.caseMetal(black, 'brushed');
    const original = lib.caseMetal(cushion, 'brushed');
    expect(satin).not.toBe(original);
    expect(satin.roughness).toBeGreaterThan(original.roughness);
    expect(satin.clearcoat).toBeLessThan(original.clearcoat);
    expect(lib.caseMetal(cushion, 'brushed')).toBe(original);
    const legacy = new MaterialLibrary(false);
    expect(legacy.caseMetal(black, 'brushed').roughness).toBe(original.roughness);
    expect(legacy.handSteel('face')).toBe(legacy.polishedSteel());
    lib.dispose();
    legacy.dispose();
  });

  it('shares the steel tonneau envelope across geometry and refined modes without mutating the pilot', () => {
    const lib = new MaterialLibrary();
    const config = blackTonneauPilot();
    config.case.material = 'steel';
    const original = structuredClone(config);
    const before = buildWatch(config, lib, { quality: 'fallback', refinement: 'geometry', layers });
    const after = buildWatch(config, lib, { quality: 'fallback', refinement: 'refined', layers });
    expect(positions(after)).toEqual(positions(before));
    expect(config).toEqual(original);
    before.dispose();
    after.dispose();
    lib.dispose();
  });

  it.each([22, 40, 48])(
    '%i mm: all hand options remain separated and material groups cover each mesh',
    (diameter) => {
      for (const set of HAND_SETS) {
        const config = blackTonneauPilot();
        config.hands.set = set;
        Object.assign(config.case, proportionsForDiameter(diameter));
        const original = structuredClone(config);
        const lib = new MaterialLibrary();
        const hands = buildHands(config, watchDimensions(config), lib, true, true);
        const root = new THREE.Group();
        root.add(hands.group, hands.seconds);
        root.updateMatrixWorld(true);
        const hour = new THREE.Box3().setFromObject(root.getObjectByName('hour-blade')!);
        const minute = new THREE.Box3().setFromObject(root.getObjectByName('minute-blade')!);
        const second = new THREE.Box3().setFromObject(root.getObjectByName('second-blade')!);
        expect(minute.min.z - hour.max.z).toBeGreaterThan(0.045);
        expect(second.min.z - minute.max.z).toBeGreaterThan(0.045);
        if (set === 'baton')
          for (const name of ['hour-blade', 'minute-blade']) {
            const mesh = root.getObjectByName(name) as THREE.Mesh;
            let offset = 0;
            for (const group of mesh.geometry.groups) {
              expect(group.start).toBe(offset);
              offset += group.count;
            }
            expect(offset).toBe(mesh.geometry.getAttribute('position').count);
          }
        expect(config).toEqual(original);
        dispose(root);
        lib.dispose();
      }
    },
  );
});
