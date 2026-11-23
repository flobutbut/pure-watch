import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { defaultConfig } from '../../core/config/defaults';
import { watchDimensions } from '../../core/geometry/dimensions';
import { dialPrintSvg } from '../../render2d/dial-print';
import { MaterialLibrary } from '../materials';
import * as textures from '../textures';
import { buildCrystal, crystalSurface } from './crystal';
import { buildWatch } from '../watch';
import { dateDiscSvg, dateWindowRect, HANDS_ORDER, LOUPE, MAGNIFIED_ORDER } from './date';
import { buildDial } from './dial';

vi.spyOn(textures, 'svgTexture').mockImplementation(() => ({
  texture: new THREE.CanvasTexture(undefined as unknown as HTMLCanvasElement),
  ready: Promise.resolve(),
}));

function dated(position: string, shape = 'round') {
  const config = defaultConfig();
  config.case.shape = shape;
  config.dial.shape = shape;
  config.complications = [{ type: 'date', position }];
  return config;
}

function lib() {
  const library = new MaterialLibrary();
  vi.spyOn(library, 'dial').mockReturnValue(library.polishedSteel());
  return library;
}

/** Aire couverte par la surface du cadran (triangles), en mm². */
function area(geometry: THREE.BufferGeometry): number {
  const p = geometry.getAttribute('position');
  const index = geometry.index;
  const at = (i: number) => new THREE.Vector3().fromBufferAttribute(p, index ? index.getX(i) : i);
  let sum = 0;
  const count = index ? index.count : p.count;
  for (let i = 0; i < count; i += 3) {
    const [a, b, c] = [at(i), at(i + 1), at(i + 2)];
    sum += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return sum;
}

function meshes(object: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  object.traverse((o) => o instanceof THREE.Mesh && out.push(o));
  return out;
}

describe('guichet de date', () => {
  it.each(['round', 'cushion', 'octagon'])(
    '%s : perce le cadran à la taille du guichet',
    (shape) => {
      const plain = defaultConfig();
      plain.case.shape = shape;
      plain.dial.shape = shape;
      const config = dated('3h', shape);
      const d = watchDimensions(config);
      const rect = dateWindowRect(config, d)!;
      const without = buildDial(plain, d, lib(), { print: false, printSize: 1 });
      const withDate = buildDial(config, d, lib(), { print: false, printSize: 1, day: 23 });
      const face = (parts: ReturnType<typeof buildDial>) => area(meshes(parts.dial)[0]!.geometry);
      const hole = face(without) - face(withDate);
      expect(hole).toBeGreaterThan(rect.width * rect.height * 0.9);
      expect(hole).toBeLessThan(rect.width * rect.height * 1.01);
      // Parois et disque sous le cadran, cerclage au-dessus.
      expect(meshes(withDate.dial).length).toBe(3);
      const frame = withDate.indices.getObjectByName('date-frame')!;
      expect(meshes(frame)).toHaveLength(1);
      // Le guichet reste dans le cadran, loin de la piste des minutes.
      expect(Math.hypot(rect.x + rect.width / 2, rect.height / 2)).toBeLessThan(
        d.dialSafeRadius * 0.86,
      );
    },
  );

  it('retire l’index de l’heure occupée, garde ceux de 4 h 30', () => {
    const count = (config: ReturnType<typeof defaultConfig>) => {
      const parts = buildDial(config, watchDimensions(config), lib(), {
        print: false,
        printSize: 1,
      });
      const index = meshes(parts.indices).find((m) => m.parent === parts.indices)!;
      return index.geometry.getAttribute('position').count;
    };
    const base = count(defaultConfig());
    expect(count(dated('3h'))).toBeLessThan(base);
    expect(count(dated('4h30'))).toBe(base);
  });

  it('un guichet nu n’a pas de cerclage', () => {
    const config = dated('6h');
    config.complications[0]!['window'] = 'plain';
    const parts = buildDial(config, watchDimensions(config), lib(), { print: false, printSize: 1 });
    expect(meshes(parts.indices.getObjectByName('date-frame')!)).toHaveLength(0);
  });

  it('retire le chiffre de l’heure occupée sans changer la taille des autres', () => {
    const base = { dialRadius: 17, chapterRing: 'none', ink: '#fff', numerals: 'cardinal' };
    const full = dialPrintSvg(base);
    const dated = dialPrintSvg({ ...base, omitHours: [3] });
    expect(full).toContain('>3</text>');
    expect(dated).not.toContain('>3</text>');
    expect(dated).toContain('>9</text>');
    const size = (svg: string) => svg.match(/font-size="([\d.]+)"/)![1];
    expect(size(dated)).toBe(size(full));
  });

  it('imprime le jour sur le disque', () => {
    const config = dated('3h');
    const rect = dateWindowRect(config, watchDimensions(config))!;
    const svg = dateDiscSvg(rect, 6, { color: '#fff', ink: '#000' }, 23, {
      family: 'Arial',
      weight: 600,
    });
    expect(svg).toContain('>23</text>');
  });

  it.each(['sapphire-domed', 'sapphire-flat', 'acrylic'])(
    '%s : la loupe repose sur le cristal, au-dessus du guichet',
    (type) => {
      const config = dated('3h');
      config.crystal.type = type;
      config.crystal.cyclops = true;
      const d = watchDimensions(config);
      const rect = dateWindowRect(config, d)!;
      for (const refined of [false, true]) {
        const crystal = buildCrystal(config, d, lib(), 'fallback', refined);
        const lens = crystal.getObjectByName('cyclops') as THREE.Mesh;
        lens.geometry.computeBoundingBox();
        const box = lens.geometry.boundingBox!;
        expect(box.min.x).toBeLessThan(rect.x - rect.width / 2);
        expect(box.max.x).toBeGreaterThan(rect.x + rect.width / 2);
        // Dessus du verre à l'aplomb du guichet, loupe exclue.
        const shell = crystal.children[0] as THREE.Mesh;
        shell.material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
        const ray = new THREE.Raycaster(
          new THREE.Vector3(rect.x, rect.y, 50),
          new THREE.Vector3(0, 0, -1),
        );
        const top = ray.intersectObject(shell)[0]!.point.z;
        // Bombée au-dessus du guichet, bord collé au verre.
        expect(box.max.z - top).toBeGreaterThan(0.3);
        expect(box.max.z - top).toBeLessThan(1.2);
        // Visible de face : normales tournées vers l'observateur.
        const normal = lens.geometry.getAttribute('normal');
        expect(normal.getZ(0)).toBeGreaterThan(0.8); // inclinée par le galbe du verre
        const p = lens.geometry.getAttribute('position');
        const edge = new THREE.Vector3().fromBufferAttribute(p, p.count - 1);
        ray.set(new THREE.Vector3(edge.x, edge.y, 50), new THREE.Vector3(0, 0, -1));
        expect(Math.abs(edge.z - ray.intersectObject(shell)[0]!.point.z)).toBeLessThan(0.08);
      }
      config.crystal.cyclops = false;
      expect(buildCrystal(config, d, lib(), 'fallback').getObjectByName('cyclops')).toBeUndefined();
    },
  );

  it('grossit le disque sous la loupe, sans montrer le bord du guichet', () => {
    const config = dated('3h');
    config.crystal.cyclops = true;
    const d = watchDimensions(config);
    const rect = dateWindowRect(config, d)!;
    const surface = crystalSurface(config, d, false);
    const parts = buildDial(config, d, lib(), {
      print: false,
      printSize: 1,
      day: 23,
      crystalSurface: surface,
    });
    const image = parts.loupe.getObjectByName('magnified-date') as THREE.Mesh;
    expect(image.renderOrder).toBe(MAGNIFIED_ORDER);
    expect((image.material as THREE.Material).depthWrite).toBe(false);

    // Coordonnées de texture : un détail du disque y occupe LOUPE.magnification fois plus de place.
    const p = image.geometry.getAttribute('position');
    const uv = image.geometry.getAttribute('uv');
    const span = Math.max(rect.width, rect.height) + 1.2;
    let widest = 0;
    for (let i = 0; i < p.count; i++) {
      const dx = p.getX(i) - rect.x;
      expect((uv.getX(i) - 0.5) * span * LOUPE.magnification).toBeCloseTo(dx, 5);
      // Le point lu sur le disque reste dans le guichet : son bord n'apparaît pas.
      expect(Math.abs(dx / LOUPE.magnification)).toBeLessThan(rect.width / 2);
      expect(Math.abs((p.getY(i) - rect.y) / LOUPE.magnification)).toBeLessThan(rect.height / 2);
      widest = Math.max(widest, Math.abs(dx));
      // Posée sur le verre, sous la loupe.
      expect(Math.abs(p.getZ(i) - surface(p.getX(i), p.getY(i)))).toBeLessThan(0.05);
    }
    expect(widest).toBeGreaterThan(rect.width * 0.8);

    config.crystal.cyclops = false;
    const plain = buildDial(config, d, lib(), {
      print: false,
      printSize: 1,
      crystalSurface: surface,
    });
    expect(plain.loupe.children).toHaveLength(0);
  });

  it('pose l’image agrandie avec le cristal, aiguilles dessinées par-dessus', () => {
    const config = dated('3h');
    config.crystal.cyclops = true;
    const watch = buildWatch(config, lib(), { quality: 'fallback' });
    expect(watch.layers.crystal.getObjectByName('magnified-date')).toBeDefined();
    expect(watch.layers.dial.getObjectByName('magnified-date')).toBeUndefined();
    const orders = new Set<number>();
    for (const layer of [watch.layers.hands, watch.layers.seconds])
      layer.traverse((o) => o instanceof THREE.Mesh && orders.add(o.renderOrder));
    expect([...orders]).toEqual([HANDS_ORDER]);
    expect(HANDS_ORDER).toBeGreaterThan(MAGNIFIED_ORDER);
    // Sans le calque du cristal (vignette du cadran), pas d'image agrandie flottante.
    const dialOnly = buildWatch(config, lib(), { quality: 'fallback', layers: ['dial'] });
    expect(dialOnly.root.getObjectByName('magnified-date')).toBeUndefined();
    watch.dispose();
    dialOnly.dispose();
  });
});
