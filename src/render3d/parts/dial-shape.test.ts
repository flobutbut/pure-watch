import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { defaultConfig } from '../../core/config/defaults';
import { proportionsForDiameter, watchDimensions } from '../../core/geometry/dimensions';
import { CASE_SHAPES, shapeRadius } from '../../core/geometry/case-shape';
import { DIAL_SHAPES, dialRadiusAt } from '../../core/geometry/dial-shape';
import { dialPrintSvg } from '../../render2d/dial-print';
import { MaterialLibrary } from '../materials';
import { buildWatch } from '../watch';
import { latheZ } from '../lathe';
import { shapeAperture } from './levels';
import { buildDial } from './dial';

const nonRound = DIAL_SHAPES.filter((s) => s !== 'round');

describe('assembled shaped dials', () => {
  it.each(nonRound)('%s: every applied index style remains inside the face', (shape) => {
    const lib = new MaterialLibrary();
    // Only geometry is under test here; dial textures require a browser canvas.
    vi.spyOn(lib, 'dial').mockReturnValue(lib.polishedSteel());
    for (const style of [
      'baton',
      'baton-facet',
      'dauphine',
      'dots',
      'triangles',
      'baguettes',
      'drops',
    ]) {
      const config = defaultConfig();
      config.case.shape = shape;
      config.dial.shape = shape;
      config.dial.indices.numerals = 'none';
      config.dial.indices.style = style;
      const d = watchDimensions(config);
      const parts = buildDial(config, d, lib, { print: false, printSize: 1 });
      parts.indices.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const p = o.geometry.getAttribute('position');
        for (let i = 0; i < p.count; i += 7) {
          const x = p.getX(i),
            y = p.getY(i);
          expect(Math.hypot(x, y), `${shape}/${style}`).toBeLessThan(
            dialRadiusAt(d, Math.atan2(y, x)),
          );
        }
      });
      for (const group of [parts.dial, parts.indices])
        group.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
    }
    lib.dispose();
  });

  it.each(CASE_SHAPES)(
    '%s: builds every dial shape with finite geometry at 22 / 40 / 48 mm',
    (caseShape) => {
      const lib = new MaterialLibrary();
      for (const diameter of [22, 40, 48])
        for (const shape of nonRound) {
          const config = defaultConfig();
          config.case.shape = caseShape;
          config.dial.shape = shape;
          Object.assign(config.case, proportionsForDiameter(diameter));
          const saved = structuredClone(config);
          const model = buildWatch(config, lib, {
            quality: 'fallback',
            layers: ['case', 'rehaut', 'crystal', 'hands', 'seconds'],
          });
          model.root.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            expect(
              Array.from(o.geometry.getAttribute('position').array).every(Number.isFinite),
            ).toBe(true);
            expect(Array.from(o.geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(
              true,
            );
          });
          expect(config).toEqual(saved);
          model.dispose();
        }
      lib.dispose();
    },
  );

  it.each(nonRound)('%s: rehaut and glass use the exact same angular contour', (shape) => {
    const config = defaultConfig();
    config.dial.shape = shape;
    const d = watchDimensions(config);
    const g = latheZ(
      [
        [d.dialRadius, 0],
        [d.openingRadius, 0.6],
      ],
      192,
    );
    shapeAperture(g, d);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i += 2) {
      const x = p.getX(i),
        y = p.getY(i);
      expect(Math.hypot(x, y)).toBeCloseTo(dialRadiusAt(d, Math.atan2(y, x)), 4);
    }
    g.dispose();
  });

  it.each(nonRound)(
    '%s: printed figures remain undistorted and the railroad follows the perimeter',
    (shape) => {
      const config = defaultConfig();
      config.dial.shape = shape;
      const d = watchDimensions(config);
      const svg = dialPrintSvg({
        dialRadius: d.dialSafeRadius,
        extent: d.dialExtent,
        radiusAt: (a) => dialRadiusAt(d, a),
        chapterRing: 'railroad',
        numerals: 'all',
        ink: '#ffffff',
      });
      expect(svg.match(/<text /g)).toHaveLength(12);
      expect(svg.match(/<path /g)).toHaveLength(2);
      expect(svg).not.toMatch(/transform="scale/);
      expect(svg).not.toContain('NaN');
      expect(new Set([...svg.matchAll(/font-size="([\d.]+)"/g)].map((m) => m[1])).size).toBe(1);
    },
  );

  it('keeps the new aperture inside the case at every sampled glass edge', () => {
    for (const body of CASE_SHAPES)
      for (const shape of nonRound) {
        const config = defaultConfig();
        config.case.shape = body;
        config.dial.shape = shape;
        const d = watchDimensions(config);
        const lib = new MaterialLibrary();
        const model = buildWatch(config, lib, { quality: 'fallback', layers: ['crystal'] });
        model.layers.crystal.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          const p = o.geometry.getAttribute('position');
          for (let i = 0; i < p.count; i += 13) {
            const r = Math.hypot(p.getX(i), p.getY(i));
            const outer = d.caseRadius * shapeRadius(body, Math.atan2(p.getY(i), p.getX(i)));
            expect(r).toBeLessThan(outer);
          }
        });
        model.dispose();
        lib.dispose();
      }
  });
});

it.each(nonRound)('%s: all glass types clear rotating hand tips at 22 / 40 / 48 mm', (shape) => {
  for (const diameter of [22, 40, 48])
    for (const glass of ['sapphire-flat', 'sapphire-domed', 'sapphire-box', 'mineral', 'acrylic']) {
      const config = defaultConfig();
      config.case.shape = shape;
      config.dial.shape = shape;
      config.crystal.type = glass;
      Object.assign(config.case, proportionsForDiameter(diameter));
      const d = watchDimensions(config);
      const lib = new MaterialLibrary();
      const model = buildWatch(config, lib, {
        quality: 'fallback',
        layers: ['hands', 'seconds', 'crystal'],
      });
      model.root.updateMatrixWorld(true);
      const crystal = model.layers.crystal.children[0]!;
      const ray = new THREE.Raycaster();
      for (const [name, length] of [
        ['hour-blade', d.hands.hour],
        ['minute-blade', d.hands.minute],
        ['second-blade', d.hands.second],
      ] as const) {
        const blade = model.root.getObjectByName(name)!;
        const origin = new THREE.Vector3().setFromMatrixPosition(blade.matrixWorld);
        const scale = new THREE.Vector3();
        blade.getWorldScale(scale);
        const top = origin.z + (name === 'second-blade' ? 0.12 : 0.16) * scale.z;
        for (let i = 0; i < 12; i++) {
          const angle = (i * Math.PI * 2) / 12;
          ray.set(
            new THREE.Vector3(
              Math.cos(angle) * length + 1e-6,
              Math.sin(angle) * length + 2e-6,
              -20,
            ),
            new THREE.Vector3(0, 0, 1),
          );
          const hit = ray.intersectObject(crystal)[0];
          expect(hit, `${shape}/${diameter}/${glass}`).toBeDefined();
          expect(hit!.point.z - top, `${shape}/${diameter}/${glass}/${name}`).toBeGreaterThan(0.01);
        }
      }
      model.dispose();
      lib.dispose();
    }
});
