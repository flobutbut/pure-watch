import * as THREE from 'three';
import { expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { defaultConfig } from '../../core/config/defaults';
import { decodeConfigHash, encodeConfigHash } from '../../core/config/url';
import { parseCatalog } from '../../core/catalog/load';
import { CASE_SHAPES } from '../../core/geometry/case-shape';
import { proportionsForDiameter, watchDimensions } from '../../core/geometry/dimensions';
import { MaterialLibrary } from '../materials';
import { buildHands, HAND_SETS, SECOND_STYLES } from './hands';

const additions = ['spear', 'pencil', 'spade', 'art-deco', 'skeleton', 'cathedral'];
const newSeconds = ['baton', 'diamond', 'teardrop', 'ring-tail', 'lightning'];
const catalog = parseCatalog(rawCatalog);
function dispose(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}

it('exposes every built geometry in the catalog and preserves previous wire identifiers', () => {
  expect(
    catalog.rows
      .find((r) => r.id === 'hands')!
      .variants.map((v) => v.id)
      .sort(),
  ).toEqual([...HAND_SETS].sort());
  expect(
    catalog.rows
      .find((r) => r.id === 'seconds')!
      .variants.map((v) => v.id)
      .sort(),
  ).toEqual([...SECOND_STYLES].sort());
  const previous = decodeConfigHash(
    `#v1.${btoa(JSON.stringify({ I: 6, L: 5 })).replace(/=+$/, '')}`,
    catalog,
  );
  expect(previous.config.hands.set).toBe('syringe');
  expect(previous.config.hands.second.style).toBe('triangle');
  for (const [index, set] of additions.entries()) {
    const config = defaultConfig();
    config.hands.set = set;
    config.hands.second.style = newSeconds[index % newSeconds.length]!;
    config.hands.finish = 'lacquer';
    config.hands.color = '#1C50B9';
    config.hands.second.color = 'match';
    const encoded = encodeConfigHash(config);
    expect(JSON.parse(atob(encoded.slice(4))).I).toBe(index + 7);
    expect(decodeConfigHash(encoded, catalog)).toEqual({ config, notice: '' });
  }
});

it.each(CASE_SHAPES)(
  '%s: new hands and every second hand stay inside the inscribed circle at 22 / 40 / 48 mm',
  (shape) => {
    const lib = new MaterialLibrary();
    for (const diameter of [22, 40, 48])
      for (const [index, second] of SECOND_STYLES.entries()) {
        const config = defaultConfig();
        config.case.shape = config.dial.shape = shape;
        Object.assign(config.case, proportionsForDiameter(diameter));
        config.hands.set = additions[index % additions.length]!;
        config.hands.second.style = second;
        config.hands.finish = 'lacquer';
        config.hands.color = '#1C50B9';
        config.hands.second.color = 'match';
        const original = structuredClone(config);
        const d = watchDimensions(config);
        const hands = buildHands(config, d, lib, true, false, true);
        const root = new THREE.Group();
        root.add(hands.group, hands.seconds);
        for (const angle of [0, 47, 135, 280]) {
          hands.setAngles({ hour: angle, minute: angle + 90, second: angle + 180 });
          root.updateMatrixWorld(true);
          const point = new THREE.Vector3();
          root.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            const p = o.geometry.getAttribute('position');
            for (let i = 0; i < p.count; i += 11) {
              point.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
              expect(point.toArray().every(Number.isFinite)).toBe(true);
              expect(Math.hypot(point.x, point.y)).toBeLessThan(d.dialSafeRadius);
            }
          });
        }
        root.updateMatrixWorld(true);
        const hour = new THREE.Box3().setFromObject(root.getObjectByName('hour-blade')!);
        const minute = new THREE.Box3().setFromObject(root.getObjectByName('minute-blade')!);
        const sec = new THREE.Box3().setFromObject(root.getObjectByName('second-blade')!);
        expect(minute.min.z - hour.max.z).toBeGreaterThan(0.045);
        expect(sec.min.z - minute.max.z).toBeGreaterThan(0.045);
        expect(config).toEqual(original);
        dispose(root);
      }
    lib.dispose();
  },
);

it.each(['skeleton', 'cathedral'])(
  '%s: cut-outs are open and their surrounding plate is solid at every size',
  (set) => {
    const lib = new MaterialLibrary();
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    for (const diameter of [22, 40, 48]) {
      const config = defaultConfig();
      Object.assign(config.case, proportionsForDiameter(diameter));
      config.hands.set = set;
      const d = watchDimensions(config),
        k = d.dialSafeRadius / 20;
      const hands = buildHands(config, d, lib, true, false, true);
      for (const [name, length, slim] of [
        ['hour-blade', d.hands.hour, 1],
        ['minute-blade', d.hands.minute, 0.78],
      ] as const) {
        const blade = hands.group.getObjectByName(name) as THREE.Mesh;
        const mesh = new THREE.Mesh(blade.geometry, material);
        mesh.updateMatrixWorld(true);
        for (const [fraction, wall] of set === 'skeleton'
          ? [[0.4, 0.73]]
          : [
              [0.28, 0.72],
              [0.56, 0.48],
              [0.77, 0.8],
            ]) {
          const ray = new THREE.Raycaster(
            new THREE.Vector3(0, length * fraction!, 5),
            new THREE.Vector3(0, 0, -1),
          );
          expect(ray.intersectObject(mesh), `${set}/${diameter}/${name}/${fraction}`).toHaveLength(
            0,
          );
          ray.ray.origin.x = wall! * k * slim;
          expect(ray.intersectObject(mesh).length).toBeGreaterThan(0);
        }
      }
      dispose(hands.group);
      dispose(hands.seconds);
    }
    material.dispose();
    lib.dispose();
  },
);

it('the pierced counterweight has an open eye and a continuous connection to the stem', () => {
  const config = defaultConfig();
  config.hands.second.style = 'ring-tail';
  const d = watchDimensions(config),
    k = d.dialSafeRadius / 20;
  const lib = new MaterialLibrary();
  const hands = buildHands(config, d, lib, true, false, true);
  const geometry = (hands.seconds.getObjectByName('second-blade') as THREE.Mesh).geometry;
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.updateMatrixWorld(true);
  const y = -d.hands.secondTail * 0.7;
  const ray = new THREE.Raycaster(new THREE.Vector3(0, y, 5), new THREE.Vector3(0, 0, -1));
  expect(ray.intersectObject(mesh)).toHaveLength(0);
  ray.ray.origin.x = 0.75 * k;
  expect(ray.intersectObject(mesh).length).toBeGreaterThan(0);
  ray.ray.origin.set(0, y + 0.95 * k, 5);
  expect(ray.intersectObject(mesh).length).toBeGreaterThan(0);
  dispose(hands.group);
  dispose(hands.seconds);
  material.dispose();
  lib.dispose();
});
