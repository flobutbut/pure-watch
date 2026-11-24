import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BEZEL_TYPES, bezelTypeForConfig } from '../../core/config/bezel';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../../core/catalog/load';
import { visibleRows } from '../../core/rules/visibility';
import { defaultConfig } from '../../core/config/defaults';
import { CASE_SHAPES, shapeRadius } from '../../core/geometry/case-shape';
import { DIAL_SHAPES } from '../../core/geometry/dial-shape';
import { proportionsForDiameter, watchDimensions } from '../../core/geometry/dimensions';
import { MaterialLibrary } from '../materials';
import { buildWatch } from '../watch';
import { caseLevels } from './levels';
import { latheZ } from '../lathe';
import { machineBezel } from './bezel';

function positions(root: THREE.Object3D) {
  const arrays: number[][] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) arrays.push(Array.from(o.geometry.getAttribute('position').array));
  });
  return arrays;
}

describe('machined bezels', () => {
  it.each(CASE_SHAPES)(
    '%s: all bezels fit every dial contour without changing dimensions',
    (shape) => {
      const lib = new MaterialLibrary();
      for (const dial of DIAL_SHAPES)
        for (const type of BEZEL_TYPES.slice(1).filter(
          (type) => !['rotating', 'fixed-scale'].includes(type),
        )) {
          const config = defaultConfig();
          config.case.shape = shape;
          config.dial.shape = dial;
          // Both ends of the supported size range, distributed across the combinations.
          Object.assign(config.case, proportionsForDiameter(dial === shape ? 22 : 48));
          const d = watchDimensions(config);
          config.bezel.type = type;
          expect(watchDimensions(config)).toEqual(d);
          const model = buildWatch(config, lib, { quality: 'fallback', layers: ['case'] });
          const { rehautTop } = caseLevels(d);
          let checked = 0;
          model.layers.case.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            const p = o.geometry.getAttribute('position');
            const n = o.geometry.getAttribute('normal');
            expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
            expect(Array.from(n.array).every(Number.isFinite)).toBe(true);
            for (let i = 0; i < p.count; i += 5) {
              if (p.getZ(i) < rehautTop + 0.01) continue;
              const x = p.getX(i),
                y = p.getY(i),
                angle = Math.atan2(y, x);
              const opening = d.openingRadius * d.dialScale * shapeRadius(d.dialShape, angle);
              expect(Math.hypot(x, y), `${shape}/${dial}/${type}`).toBeGreaterThanOrEqual(
                opening - 0.0001,
              );
              expect(p.getZ(i)).toBeLessThanOrEqual(d.z.bezelTop + 0.0001);
              checked++;
            }
          });
          expect(checked).toBeGreaterThan(0);
          model.dispose();
        }
      lib.dispose();
    },
    20_000,
  );

  it('each style has distinct geometry, with the historical smooth fallback intact', () => {
    const lib = new MaterialLibrary();
    const signatures = new Set<string>();
    let smooth: number[][] = [];
    for (const type of [...BEZEL_TYPES, 'unknown-future-type']) {
      const config = defaultConfig();
      config.bezel.type = type;
      const model = buildWatch(config, lib, { quality: 'fallback', layers: ['case'] });
      const data = positions(model.layers.case);
      if (type === 'smooth') smooth = data;
      if (type === 'unknown-future-type') expect(data).toEqual(smooth);
      else signatures.add(JSON.stringify(data));
      model.dispose();
    }
    expect(signatures.size).toBe(BEZEL_TYPES.length);
    lib.dispose();
  });

  it.each(['fluted', 'coin', 'notched'])(
    '%s: cuts never reach the glass seat or the midcase',
    (type) => {
      const d = watchDimensions(defaultConfig());
      const { flankTop, seat, rehautTop } = caseLevels(d);
      const geometry = latheZ(
        [
          [d.caseRadius, flankTop - 1],
          [d.caseRadius, flankTop],
          [d.caseRadius - 0.65, d.z.bezelTop - 0.4],
          [d.caseRadius - 0.65, d.z.bezelTop],
          [d.openingRadius, seat],
          [d.openingRadius, rehautTop],
        ],
        576,
      );
      const before = geometry.getAttribute('position').clone();
      machineBezel(geometry, type, d);
      const after = geometry.getAttribute('position');
      let changed = 0;
      for (let i = 0; i < before.count; i++) {
        if (i % 6 < 2 || i % 6 > 3) {
          expect(after.getX(i)).toBeCloseTo(before.getX(i), 5);
          expect(after.getY(i)).toBeCloseTo(before.getY(i), 5);
          expect(after.getZ(i)).toBeCloseTo(before.getZ(i), 5);
        }
        if (Math.abs(after.getX(i) - before.getX(i)) > 0.0001) changed++;
      }
      expect(changed).toBeGreaterThan(0);
      geometry.dispose();
    },
  );

  it('keeps machining available when the circular aperture is fitted to a rectangular case', () => {
    const rows = parseCatalog(rawCatalog).rows;
    const config = defaultConfig();
    config.bezel.type = 'fluted';
    for (const shape of CASE_SHAPES)
      for (const dial of DIAL_SHAPES) {
        config.case.shape = shape;
        config.dial.shape = dial;
        expect(visibleRows(rows, config).some((r) => r.id === 'bezel')).toBe(true);
        expect(bezelTypeForConfig(config)).toBe('fluted');
      }
  });
});
