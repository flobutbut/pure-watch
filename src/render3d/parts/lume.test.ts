import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../core/config/defaults';
import { proportionsForDiameter, watchDimensions } from '../../core/geometry/dimensions';
import { MaterialLibrary } from '../materials';
import { INDEX_REACH, buildIndices } from './dial';
import { buildHands, HAND_SETS } from './hands';

const dispose = (object: THREE.Object3D) =>
  object.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
describe('inserts lumineux construits en géométrie', () => {
  it('renders one customized index with its own shape and pigment without changing the others', () => {
    const config = defaultConfig();
    config.dial.indices.lume = 'c3';
    config.details = {
      indices: {
        '12': { style: 'triangles', indexLength: 1.3, lume: 'bgw9' },
        '3': { style: 'none' },
      },
    };
    const lib = new MaterialLibrary(true, true);
    const group = buildIndices(config, watchDimensions(config), lib);
    const twelve = group.getObjectByName('index-12h')!;
    const blue = twelve.getObjectByName('indices-lume') as THREE.Mesh;
    expect((blue.material as THREE.MeshStandardMaterial).emissive.getHexString()).toBe('65caff');
    expect(group.getObjectByName('index-3h')!.children).toHaveLength(0);
    const ordinary = group.children.find((c) => c.name === 'indices')!;
    const green = ordinary.getObjectByName('indices-lume') as THREE.Mesh;
    expect((green.material as THREE.MeshStandardMaterial).emissive.getHexString()).toBe('78ffc1');
    dispose(group);
    lib.dispose();
  });
  it('le rendu suit le pigment malgré un RGB incohérent, avec une intensité indicative propre à la référence', () => {
    const config = defaultConfig();
    Object.assign(config.hands, { lume: 'bgw9', lumeColor: '#FF0000', lumeEmission: '#FF0000' });
    const night = new MaterialLibrary(true, true);
    const blue = night.luminous(config.hands);
    expect(blue.color.getHexString().toUpperCase()).toBe('EDF1E9');
    expect(blue.emissive.getHexString().toUpperCase()).toBe('65CAFF');
    config.hands.lume = 'c3';
    const green = night.luminous(config.hands);
    config.hands.lume = 'c1';
    const white = night.luminous(config.hands);
    expect(green.emissiveIntensity).toBeGreaterThan(blue.emissiveIntensity);
    expect(white.emissiveIntensity).toBeLessThan(green.emissiveIntensity);
    config.hands.lume = 'custom';
    expect(['78ffc1', '65caff', 'b5ff78']).toContain(
      night.luminous(config.hands).emissive.getHexString(),
    );
    night.dispose();
  });
  it.each(HAND_SETS)(
    '%s : un insert dans chaque aiguille, dans son enveloppe et sous le métal',
    (set) => {
      for (const diameter of [22, 40, 48]) {
        const config = defaultConfig();
        Object.assign(config.case, proportionsForDiameter(diameter));
        config.hands.set = set;
        config.hands.lume = 'custom';
        const d = watchDimensions(config);
        const lib = new MaterialLibrary();
        const hands = buildHands(config, d, lib, true, false, true);
        for (const name of ['hour', 'minute'] as const) {
          const insert = hands.group.getObjectByName(`${name}-lume`) as THREE.Mesh;
          const frame = hands.group.getObjectByName(`${name}-blade`) as THREE.Mesh;
          insert.geometry.computeBoundingBox();
          frame.geometry.computeBoundingBox();
          expect(insert.geometry.boundingBox!.max.z).toBeLessThan(
            frame.geometry.boundingBox!.max.z,
          );
          const box = insert.geometry.boundingBox!;
          expect(box.min.y).toBeGreaterThan(0);
          expect(box.max.y).toBeLessThan(d.hands[name]);
          const p = insert.geometry.getAttribute('position');
          expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
          hands.group.updateMatrixWorld(true);
          const y = d.hands[name] * (set === 'breguet' ? 0.72 : 0.52);
          const ray = new THREE.Raycaster(new THREE.Vector3(0, y, 10), new THREE.Vector3(0, 0, -1));
          const hit = ray.intersectObjects([frame, insert])[0];
          expect(hit?.object.name, `${set}/${diameter}/${name}: insert exposed in the cavity`).toBe(
            `${name}-lume`,
          );
        }
        dispose(hands.group);
        dispose(hands.seconds);
        lib.dispose();
      }
    },
  );
  it.each([
    'baton',
    'baton-facet',
    'dauphine',
    'dots',
    'triangles',
    'baguettes',
    'drops',
    'dive',
    'mixed-batons',
  ])('%s : les inserts suivent les index et évitent les chiffres et complications', (style) => {
    const config = defaultConfig();
    Object.assign(config.dial.indices, {
      style,
      lume: 'custom',
      numerals: 'twelve',
      indexLength: 1.6,
      indexWidth: 1.8,
      indexRadius: 1.1,
    });
    config.complications = [
      { type: 'date', position: '3h' },
      { type: 'small-seconds', position: '6h' },
    ];
    const lib = new MaterialLibrary();
    const d = watchDimensions(config);
    const indices = buildIndices(config, d, lib);
    const mesh = indices.getObjectByName('indices-lume') as THREE.Mesh;
    const hours = new Set<number>();
    const p = mesh.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i);
      expect(Number.isFinite(x + y + p.getZ(i))).toBe(true);
      expect(Math.max(Math.abs(x), Math.abs(y))).toBeLessThanOrEqual(
        d.dialSafeRadius * INDEX_REACH + 1e-3,
      );
      hours.add((Math.round((Math.atan2(x, y) * 6) / Math.PI) + 12) % 12);
    }
    expect([...hours].sort((a, b) => a - b)).toEqual([1, 2, 4, 5, 7, 8, 9, 10, 11]);
    dispose(indices);
    lib.dispose();
  });
  it('l’impression est plate, la matière nocturne émet seule et les matériaux de jour restent inchangés', () => {
    const config = defaultConfig();
    config.dial.indices.finish = 'printed';
    const day = new MaterialLibrary();
    const night = new MaterialLibrary(true, true);
    const group = buildIndices(config, watchDimensions(config), day);
    const mesh = group.getObjectByName('indices-printed') as THREE.Mesh;
    mesh.geometry.computeBoundingBox();
    expect(mesh.geometry.boundingBox!.max.z).toBeCloseTo(0.025);
    expect((mesh.material as THREE.MeshStandardMaterial).metalness).toBe(0);
    expect(day.luminous(config.hands).emissiveIntensity).toBe(0);
    expect(night.luminous(config.hands).emissiveIntensity).toBeGreaterThan(1);
    expect(night.luminous(config.hands).emissive.getHexString().toUpperCase()).toBe('78FFC1');
    expect(day.luminous(config.hands)).not.toBe(night.luminous(config.hands));
    dispose(group);
    day.dispose();
    night.dispose();
  });
});
