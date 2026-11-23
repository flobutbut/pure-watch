import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { blackTonneauPilot } from '../../core/config/pilot';
import { proportionsForDiameter, watchDimensions } from '../../core/geometry/dimensions';
import { MaterialLibrary } from '../materials';
import { buildHands, HAND_SETS } from './hands';
import { piercedBreguet } from './hand-detail';

const dimensions = [22, 40, 48];
function dispose(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}

describe('hand finishing across all designs', () => {
  it.each(HAND_SETS)(
    '%s: preserves reach, separation and finite material groups at all catalog sizes',
    (set) => {
      for (const diameter of dimensions) {
        const config = blackTonneauPilot();
        config.hands.set = set;
        Object.assign(config.case, proportionsForDiameter(diameter));
        const original = structuredClone(config);
        const d = watchDimensions(config);
        const lib = new MaterialLibrary();
        const old = buildHands(config, d, lib, true, true);
        const next = buildHands(config, d, lib, true, true, true);
        const root = new THREE.Group();
        root.add(next.group, next.seconds);
        root.updateMatrixWorld(true);
        const hour = new THREE.Box3().setFromObject(root.getObjectByName('hour-blade')!);
        const minute = new THREE.Box3().setFromObject(root.getObjectByName('minute-blade')!);
        const second = new THREE.Box3().setFromObject(root.getObjectByName('second-blade')!);
        expect(minute.min.z - hour.max.z).toBeGreaterThan(0.045);
        expect(second.min.z - minute.max.z).toBeGreaterThan(0.045);
        for (const name of ['hour-blade', 'minute-blade']) {
          const blade = root.getObjectByName(name) as THREE.Mesh;
          const legacy = old.group.getObjectByName(name) as THREE.Mesh;
          blade.geometry.computeBoundingBox();
          legacy.geometry.computeBoundingBox();
          expect(
            Math.abs(blade.geometry.boundingBox!.max.y - legacy.geometry.boundingBox!.max.y),
          ).toBeLessThan(0.05);
          let end = 0;
          expect(blade.geometry.groups).toHaveLength(2);
          for (const group of blade.geometry.groups) {
            expect(group.start).toBe(end);
            end += group.count;
          }
          expect(end).toBe(blade.geometry.getAttribute('position').count);
          for (const key of ['position', 'normal'])
            expect(Array.from(blade.geometry.getAttribute(key).array).every(Number.isFinite)).toBe(
              true,
            );
        }
        expect(config).toEqual(original);
        dispose(root);
        dispose(old.group);
        dispose(old.seconds);
        lib.dispose();
      }
    },
  );

  it.each(dimensions)(
    '%i mm: Breguet eye remains open and its two connections are solid',
    (diameter) => {
      const config = blackTonneauPilot();
      Object.assign(config.case, proportionsForDiameter(diameter));
      const d = watchDimensions(config);
      const k = d.dialRadius / 20;
      for (const [length, slimness] of [
        [d.hands.hour, 1],
        [d.hands.minute, 0.78],
      ]) {
        const geometry = piercedBreguet(length!, k, slimness!, 0.16);
        const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.updateMatrixWorld(true);
        const ray = new THREE.Raycaster();
        const ringY = length! * 0.72;
        const scale = k * slimness!;
        const hits = (x: number, y: number) => {
          ray.set(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1));
          return ray.intersectObject(mesh).length;
        };
        expect(hits(0, ringY)).toBe(0);
        expect(hits(1.05 * scale, ringY)).toBeGreaterThan(0);
        expect(hits(0, ringY - 1.15 * scale)).toBeGreaterThan(0);
        expect(hits(0, ringY + 1.15 * scale)).toBeGreaterThan(0);
        geometry.dispose();
        material.dispose();
      }
    },
  );
});

it('Breguet is one closed pierced plate without degenerate surface normals', () => {
  const geometry = piercedBreguet(12.5, 1, 1, 0.16);
  const p = geometry.getAttribute('position');
  const n = geometry.getAttribute('normal');
  const edges = new Map<string, number>();
  const vertex = (i: number) =>
    [p.getX(i), p.getY(i), p.getZ(i)].map((v) => Math.round(v * 1e5)).join(',');
  for (let i = 0; i < n.count; i++)
    expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 4);
  for (let i = 0; i < p.count; i += 3) {
    const triangle = [vertex(i), vertex(i + 1), vertex(i + 2)];
    for (let j = 0; j < 3; j++) {
      const edge = [triangle[j]!, triangle[(j + 1) % 3]!].sort().join('|');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  expect([...edges.values()].every((count) => count === 2)).toBe(true);
  geometry.dispose();
});
