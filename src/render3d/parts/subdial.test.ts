import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { defaultConfig } from '../../core/config/defaults';
import { watchDimensions } from '../../core/geometry/dimensions';
import { MaterialLibrary } from '../materials';
import * as textures from '../textures';
import { dateWindowRect } from './date';
import { buildDial } from './dial';
import { buildHands } from './hands';
import { azureSvg, subdialOf, subdialSvg, SUNKEN_DEPTH } from './subdial';

vi.spyOn(textures, 'svgTexture').mockImplementation(() => ({
  texture: new THREE.CanvasTexture(undefined as unknown as HTMLCanvasElement),
  ready: Promise.resolve(),
}));

function withSeconds(position: string, style?: string) {
  const config = defaultConfig();
  config.complications = [{ type: 'small-seconds', position, ...(style ? { style } : {}) }];
  return config;
}

function lib() {
  const library = new MaterialLibrary();
  vi.spyOn(library, 'dial').mockReturnValue(library.polishedSteel());
  return library;
}

const build = (config: ReturnType<typeof defaultConfig>) =>
  buildDial(config, watchDimensions(config), lib(), { print: true, printSize: 1 });

describe('sous-cadran de la petite seconde', () => {
  it.each(['3h', '6h', '9h', '12h'])('%s : reste dans le cadran, loin de la piste', (position) => {
    const config = withSeconds(position);
    const d = watchDimensions(config);
    const c = subdialOf(config, d)!;
    expect(Math.hypot(c.x, c.y) + c.r).toBeLessThan(d.dialSafeRadius * 0.9);
  });

  it('ne touche pas une date à 4 h 30', () => {
    for (const position of ['3h', '6h']) {
      const config = withSeconds(position);
      config.complications.push({ type: 'date', position: '4h30' });
      const d = watchDimensions(config);
      const c = subdialOf(config, d)!;
      const w = dateWindowRect(config, d)!;
      // Point du guichet le plus proche du centre du sous-cadran.
      const nx = Math.max(w.x - w.width / 2, Math.min(c.x, w.x + w.width / 2));
      const ny = Math.max(w.y - w.height / 2, Math.min(c.y, w.y + w.height / 2));
      expect(Math.hypot(nx - c.x, ny - c.y)).toBeGreaterThan(c.r + 0.3);
    }
  });

  it('déplace la trotteuse dans le sous-cadran, sous les autres aiguilles', () => {
    const config = withSeconds('6h');
    const d = watchDimensions(config);
    const c = subdialOf(config, d)!;
    const hands = buildHands(config, d, lib());
    const pivot = hands.seconds.children[0]!;
    expect(pivot.position.x).toBeCloseTo(c.x);
    expect(pivot.position.y).toBeCloseTo(c.y);
    const hour = hands.group.getObjectByName('hour-blade')!.parent!;
    expect(pivot.position.z).toBeLessThan(hour.position.z);
    // L'aiguille tient dans le sous-cadran.
    const blade = hands.seconds.getObjectByName('second-blade') as THREE.Mesh;
    blade.geometry.computeBoundingBox();
    const box = blade.geometry.boundingBox!;
    expect(box.max.y).toBeLessThan(c.r);
    expect(box.max.y).toBeGreaterThan(c.r * 0.75);
    // Sans petite seconde, la trotteuse revient au centre.
    const central = buildHands(defaultConfig(), d, lib()).seconds.children[0]!;
    expect([central.position.x, central.position.y]).toEqual([0, 0]);
  });

  it('retire l’index et le chiffre de l’heure occupée', () => {
    const count = (config: ReturnType<typeof defaultConfig>) =>
      (build(config).indices.children[0] as THREE.Mesh).geometry.getAttribute('position').count;
    expect(count(withSeconds('9h'))).toBeLessThan(count(defaultConfig()));
  });

  it('en creux : perce le cadran et pose un fond assombri au pied de la paroi', () => {
    const config = withSeconds('6h', 'sunken');
    const parts = build(config);
    const subdial = parts.dial.getObjectByName('subdial')!;
    const floor = subdial.children.find((o) => (o as THREE.Mesh).geometry.getAttribute('color'));
    expect(floor!.position.z).toBeCloseTo(-SUNKEN_DEPTH);
    const color = (floor as THREE.Mesh).geometry.getAttribute('color');
    const shades = Array.from({ length: color.count }, (_, i) => color.getX(i));
    expect(Math.max(...shades)).toBe(1);
    expect(Math.min(...shades)).toBeLessThan(0.6);
    // Le disque du cadran est percé : moins de matière qu'un cadran plat.
    const area = (g: THREE.BufferGeometry) => {
      const p = g.getAttribute('position');
      const index = g.index!;
      let sum = 0;
      for (let i = 0; i < index.count; i += 3) {
        const [a, b, c] = [0, 1, 2].map((k) =>
          new THREE.Vector3().fromBufferAttribute(p, index.getX(i + k)),
        ) as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
        sum += b.sub(a).cross(c.sub(a)).length() / 2;
      }
      return sum;
    };
    const flat = build(withSeconds('6h', 'flat'));
    const face = (p: ReturnType<typeof build>) => (p.dial.children[0] as THREE.Mesh).geometry;
    const r = subdialOf(config, watchDimensions(config))!.r;
    expect(area(face(flat)) - area(face(parts))).toBeCloseTo(Math.PI * r * r, 0);
    // L'impression du sous-cadran descend dans la cuvette.
    const print = parts.print.getObjectByName('subdial-print')!.children[0]!;
    expect(print.position.z).toBeLessThan(-SUNKEN_DEPTH + 0.05);
  });

  it('azuré : un disque à sillons au-dessus du cadran', () => {
    const config = withSeconds('9h', 'azure');
    const library = lib();
    const parts = buildDial(config, watchDimensions(config), library, {
      print: true,
      printSize: 1,
    });
    const disc = parts.dial.getObjectByName('subdial')!.children[0] as THREE.Mesh;
    expect(disc.position.z).toBeGreaterThan(0);
    expect(library.dial).toHaveBeenCalledWith(
      expect.objectContaining({ dial: expect.objectContaining({ finish: 'azure' }) }),
      expect.any(Number),
    );
    expect(azureSvg(5).match(/<circle/g)!.length).toBeGreaterThan(60);
  });

  it('imprime les secondes de dix en dix, ou de quinze en quinze avec le chemin de fer', () => {
    const font = { family: 'Arial', weight: 400 };
    const flat = subdialSvg(5, 'flat', '#000', font);
    const rail = subdialSvg(5, 'rail', '#000', font);
    expect(flat.match(/>(\d+)<\/text>/g)).toHaveLength(6);
    expect(rail.match(/>(\d+)<\/text>/g)).toHaveLength(4);
    expect(flat.match(/<line/g)).toHaveLength(60);
    expect(rail.match(/<circle/g)).toHaveLength(2);
  });
});
