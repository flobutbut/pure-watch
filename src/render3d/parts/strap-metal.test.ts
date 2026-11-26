import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { defaultConfig } from '../../core/config/defaults';
import { STRAP_LENGTHS } from '../../core/config/strap';
import { StrapBuilder } from './strap-geometry';
import { metalClasp, metalRootHinge, metalTerminal } from './strap-metal';

function dispose(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
  });
}

describe('articulations des bracelets métal', () => {
  it.each([0.4, 0.24])('les charnons %.2f alternent et gardent leur passage d’axe', (fraction) => {
    const builder = new StrapBuilder((x, s, z) => new THREE.Vector3(x, s, z)),
      material = new THREE.MeshStandardMaterial();
    metalRootHinge(builder, 20, fraction, 1, material, material);
    const root = builder.finish();
    root.updateMatrixWorld(true);
    const knuckle = root.getObjectByName('strap-link-knuckle')!;
    const ray = (x: number) =>
      new THREE.Raycaster(
        new THREE.Vector3(x, 3.7, 10),
        new THREE.Vector3(0, 0, -1),
      ).intersectObject(knuckle, true);
    expect(ray(0).length).toBeGreaterThan(0);
    expect(ray(8).length).toBeGreaterThan(0);
    expect(ray(10 * fraction)).toHaveLength(0);
    expect(
      new THREE.Raycaster(
        new THREE.Vector3(-30, 3.7, 1.4),
        new THREE.Vector3(1, 0, 0),
      ).intersectObject(knuckle, true),
    ).toHaveLength(0);
    dispose(root);
    material.dispose();
  });

  it.each(
    ['three-link', 'five-link', 'mesh'].flatMap((material) =>
      (['short', 'standard', 'long'] as const).map((length) => ({ material, length })),
    ),
  )(
    '$material / $length : le fermoir rejoint les axes réels des deux brins',
    ({ material, length }) => {
      const point = (x: number, s: number, z: number, sign: number) => {
        const angle = s / 38;
        return new THREE.Vector3(
          sign * x,
          sign * (24 * Math.cos(angle) + 32 * Math.sin(angle)),
          -5 - 31 * (1 - Math.cos(angle)) + z,
        );
      };
      const builder = new StrapBuilder(point),
        metal = new THREE.MeshStandardMaterial(),
        strap = { ...defaultConfig().strap!, type: 'metal', material, length };
      metalClasp(builder, strap, () => 16, metal, metal, metal);
      const root = builder.finish();
      const mount = root.getObjectByName('strap-clasp-mount') as THREE.Mesh;
      const ends = STRAP_LENGTHS[length].map((mm, index) => {
        const terminal = metalTerminal(strap, mm);
        return point(0, terminal.s, terminal.z, index === 0 ? 1 : -1);
      });
      const p = mount.geometry.attributes.position!;
      const counts = [0, 0];
      for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, i);
        const distances = ends.map((end) => Math.hypot(v.y - end.y, v.z - end.z));
        const nearest = distances[0]! < distances[1]! ? 0 : 1;
        expect(distances[nearest]).toBeLessThanOrEqual(0.501);
        counts[nearest]!++;
      }
      expect(counts.every((count) => count > 0)).toBe(true);
      root.traverse((object) => {
        if (object instanceof THREE.Mesh)
          expect(
            Array.from(object.geometry.attributes.position!.array).every(Number.isFinite),
          ).toBe(true);
      });
      dispose(root);
      metal.dispose();
    },
  );
});
