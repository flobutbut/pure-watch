import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../../core/catalog/load';
import { defaultConfig } from '../../core/config/defaults';
import { applyVariant } from '../../core/nav/selection';
import { STRAP_TYPES, STRAP_STYLES } from '../../core/config/strap';
import { watchDimensions } from '../../core/geometry/dimensions';
import { PartRenderer3D } from '../part-renderer';
import { buildStrap } from './strap';
import { MaterialLibrary } from '../materials';
const catalog = parseCatalog(rawCatalog);
const row = catalog.rows.find((r) => r.id === 'strap')!;
describe('rendu du bracelet', () => {
  it('régénère les aperçus pour la boucle, le boîtier et les dimensions, sans dépendre des aiguilles', () => {
    const renderer = new PartRenderer3D(catalog);
    const config = applyVariant(defaultConfig(), row, 0);
    const key = (watch = config) =>
      renderer.cacheKey({
        rowId: 'strap',
        variantId: 'metal',
        context: 'none',
        config: watch,
        sizePx: 160,
        pixelRatio: 1,
      });
    expect(key({ ...config, hands: { ...config.hands, set: 'leaf' } })).toBe(key());
    expect(key({ ...config, case: { ...config.case, material: 'gold-yellow' } })).not.toBe(key());
    expect(key({ ...config, strap: { ...config.strap, buckleFinish: 'black' } })).not.toBe(key());
  });
  it('garde les faces extérieures visibles sur les deux brins et suit le métal de la boucle', () => {
    const lib = new MaterialLibrary();
    const config = defaultConfig();
    config.case.material = 'gold-yellow';
    const d = watchDimensions(config);
    const group = buildStrap(config, d, lib);
    const top = d.z.back + d.caseThickness * 0.28 + 2.6;
    const band = group.children.find((child) => child.name === 'strap-band') as THREE.Mesh;
    const position = band.geometry.attributes.position!;
    const normal = band.geometry.attributes.normal!;
    for (const sign of [-1, 1]) {
      let faces = 0;
      for (let i = 0; i < position.count; i++) {
        if (
          sign * position.getY(i) > 21 &&
          sign * position.getY(i) < 24 &&
          position.getZ(i) > top - 0.2 &&
          normal.getZ(i) > 0.8
        )
          faces++;
      }
      expect(faces).toBeGreaterThan(0);
    }
    const buckle = group.children.find((child) => child.name === 'strap-buckle') as THREE.Mesh;
    expect(buckle.material).toBe(lib.caseMetal(config, 'brushed'));
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    });
    lib.dispose();
  });
  it.each(
    STRAP_TYPES.flatMap((type, index) =>
      STRAP_STYLES[type].map((material) => ({ type, index, material })),
    ),
  )(
    '$type / $material : géométrie finie, fermoir et budget de rendu',
    ({ type, index, material }) => {
      const lib = new MaterialLibrary();
      const config = applyVariant(defaultConfig(), row, index);
      config.strap = { ...config.strap, material };
      const group = buildStrap(config, watchDimensions(config), lib);
      const box = new THREE.Box3().setFromObject(group);
      expect(box.min.y).toBeLessThan(-35);
      expect(box.max.y).toBeGreaterThan(35);
      expect(box.max.z).toBeLessThan(0);
      expect(
        group.children.some((m) => m.name === (type === 'metal' ? 'strap-clasp' : 'strap-buckle')),
      ).toBe(true);
      let triangles = 0;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const position = child.geometry.attributes.position!;
          expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
          expect(Array.from(child.geometry.attributes.normal!.array).every(Number.isFinite)).toBe(
            true,
          );
          triangles += (child.geometry.index?.count ?? position.count) / 3;
          child.geometry.dispose();
        }
      });
      expect(group.children.length).toBeLessThanOrEqual(24);
      expect(triangles).toBeLessThan(150_000);
      if (material === 'mesh') {
        expect(group.children.some((m) => m.name === 'strap-band')).toBe(false);
        expect(group.children.filter((m) => m.name === 'strap-mesh-wire')).toHaveLength(2);
      }
      if (type === 'leather')
        expect(group.children.some((m) => m.name === 'strap-lining')).toBe(true);
      lib.dispose();
    },
  );
  it('les perforations rallye traversent aussi la doublure', () => {
    const lib = new MaterialLibrary();
    const config = defaultConfig();
    config.strap.material = 'rally';
    const group = buildStrap(config, watchDimensions(config), lib);
    group.updateMatrixWorld(true);
    const distance = (x: number) =>
      new THREE.Raycaster(
        new THREE.Vector3(x, 31.5, 5),
        new THREE.Vector3(0, 0, -1),
      ).intersectObject(group, true)[0]?.distance ?? Infinity;
    expect(distance(0)).toBeGreaterThan(15);
    expect(distance(4)).toBeLessThan(12);
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    });
    lib.dispose();
  });
  it('les rayures restent à la surface du tissu après courbure', () => {
    const lib = new MaterialLibrary(),
      config = defaultConfig();
    config.strap = { ...config.strap, type: 'fabric', material: 'striped', color: '#586354' };
    const group = buildStrap(config, watchDimensions(config), lib);
    group.updateMatrixWorld(true);
    const hits = new THREE.Raycaster(
      new THREE.Vector3(3.3, 31.5, 5),
      new THREE.Vector3(0, 0, -1),
    ).intersectObject(group, true);
    expect(hits[0]?.object.name).toBe('strap-stripe');
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    });
    lib.dispose();
  });
  it('les remontages partagent les matériaux mais possèdent leurs géométries', () => {
    const lib = new MaterialLibrary(),
      config = defaultConfig(),
      d = watchDimensions(config);
    const first = buildStrap(config, d, lib),
      second = buildStrap(config, d, lib);
    const a = first.children[0] as THREE.Mesh,
      b = second.children[0] as THREE.Mesh;
    expect(a.geometry).not.toBe(b.geometry);
    expect(a.geometry.attributes.position!.array).not.toBe(b.geometry.attributes.position!.array);
    expect(a.material).toBe(b.material);
    expect(a.geometry.attributes.position!.array).toEqual(b.geometry.attributes.position!.array);
    for (const root of [first, second])
      root.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
    lib.dispose();
  });
});
