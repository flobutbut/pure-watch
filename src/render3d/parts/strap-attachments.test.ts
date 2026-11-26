import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { StrapBuilder } from './strap-geometry';
import { caseStrapEye, buckleStrapEye, rolledStrapEnd } from './strap-attachments';

const identity = (x: number, s: number, z: number) => new THREE.Vector3(x, s, z);
function dispose(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}

describe('attaches arrondies des bracelets souples', () => {
  it.each(['leather', 'fabric', 'rubber'])(
    '%s : nez circulaire et passage de barrette dégagé',
    (type) => {
      const builder = new StrapBuilder(identity),
        material = new THREE.MeshStandardMaterial();
      const eye = caseStrapEye(type, 0.6, 1.25);
      rolledStrapEnd(
        builder,
        eye,
        () => 20,
        () => (type === 'fabric' ? 1.25 : 2.6),
        material,
        material,
        1,
        'eye',
      );
      const root = builder.finish();
      root.updateMatrixWorld(true);
      const through = new THREE.Raycaster(
        new THREE.Vector3(-30, eye.s, eye.z),
        new THREE.Vector3(1, 0, 0),
      );
      expect(through.intersectObject(root, true)).toHaveLength(0);
      const nose = eye.s - eye.radius * 0.75;
      const outer = new THREE.Raycaster(
        new THREE.Vector3(0, nose, 10),
        new THREE.Vector3(0, 0, -1),
      ).intersectObject(root, true);
      expect(outer.length).toBeGreaterThan(0);
      const expected = eye.z + eye.radius * Math.sqrt(1 - 0.75 ** 2);
      expect(Math.abs(outer[0]!.point.z - expected)).toBeLessThan(0.16);
      const box = new THREE.Box3().setFromObject(root);
      expect(box.min.y).toBeLessThan(eye.s - eye.radius * 0.95);
      expect(box.max.y).toBeCloseTo(eye.s + eye.reach, 0);
      dispose(root);
      material.dispose();
    },
  );
  it.each(['leather', 'fabric', 'rubber'])(
    '%s : les deux oreilles laissent passer l’ardillon',
    (type) => {
      const builder = new StrapBuilder(identity),
        material = new THREE.MeshStandardMaterial();
      const eye = buckleStrapEye(type, 75);
      rolledStrapEnd(
        builder,
        eye,
        () => 16,
        () => 2.2,
        material,
        material,
        1,
        'eye',
        1.8,
      );
      const root = builder.finish();
      root.updateMatrixWorld(true);
      const ray = (x: number) =>
        new THREE.Raycaster(
          new THREE.Vector3(x, eye.s, 10),
          new THREE.Vector3(0, 0, -1),
        ).intersectObject(root, true);
      expect(ray(0)).toHaveLength(0);
      expect(ray(4).length).toBeGreaterThan(0);
      expect(new THREE.Box3().setFromObject(root).min.y).toBeLessThan(eye.s - eye.reach + 0.1);
      dispose(root);
      material.dispose();
    },
  );
  it('le cadre métallique reste rigide sur la courbure du bracelet', () => {
    const builder = new StrapBuilder(
      (x, s, z) => new THREE.Vector3(x, (25 + z) * Math.sin(s / 25), (25 + z) * Math.cos(s / 25)),
    );
    const hardware = builder.rigid(20, 1),
      material = new THREE.MeshStandardMaterial();
    hardware.box(0, 20, 1, 10, 12, 1, 1, material, 'frame');
    builder.absorb(hardware);
    const root = builder.finish(),
      mesh = root.getObjectByName('frame') as THREE.Mesh;
    const p = mesh.geometry.attributes.position!;
    let longest = 0;
    for (let i = 0; i < p.count; i++)
      for (let j = i + 1; j < p.count; j++)
        longest = Math.max(
          longest,
          new THREE.Vector3()
            .fromBufferAttribute(p, i)
            .distanceTo(new THREE.Vector3().fromBufferAttribute(p, j)),
        );
    expect(longest).toBeCloseTo(Math.sqrt(10 ** 2 + 12 ** 2 + 1), 4);
    dispose(root);
    material.dispose();
  });
});
