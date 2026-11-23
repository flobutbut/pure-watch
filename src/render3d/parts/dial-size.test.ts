import * as THREE from 'three';
import { expect, it } from 'vitest';
import { defaultConfig } from '../../core/config/defaults';
import { DIAL_SIZES } from '../../core/config/dial-size';
import { CASE_SHAPES } from '../../core/geometry/case-shape';
import { DIAL_SHAPES } from '../../core/geometry/dial-shape';
import { proportionsForDiameter, watchDimensions } from '../../core/geometry/dimensions';
import { MaterialLibrary } from '../materials';
import { buildWatch } from '../watch';
import { caseLevels } from './levels';
it.each(CASE_SHAPES)(
  '%s: changing the aperture retains the lower case, lugs and crown positions',
  (shape) => {
    const lib = new MaterialLibrary();
    let reference: string | undefined;
    for (const size of DIAL_SIZES) {
      const config = defaultConfig();
      config.case.shape = shape;
      config.dial.size = size;
      const d = watchDimensions(config);
      const { flankTop } = caseLevels(d);
      const model = buildWatch(config, lib, {
        quality: 'fallback',
        layers: ['case', 'lugs', 'crown'],
      });
      const points: number[] = [];
      model.root.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const p = o.geometry.getAttribute('position');
        for (let i = 0; i < p.count; i++)
          if (p.getZ(i) < flankTop - 0.001) points.push(p.getX(i), p.getY(i), p.getZ(i));
      });
      const actual = JSON.stringify(points);
      if (reference === undefined) reference = actual;
      else expect(actual).toBe(reference);
      model.dispose();
    }
    lib.dispose();
  },
);
it.each(CASE_SHAPES)(
  '%s: every dial contour and aperture size builds finite geometry',
  (shape) => {
    const lib = new MaterialLibrary();
    for (const dial of DIAL_SHAPES)
      for (const size of DIAL_SIZES) {
        const config = defaultConfig();
        config.case.shape = shape;
        config.dial.shape = dial;
        config.dial.size = size;
        Object.assign(config.case, proportionsForDiameter(size === 'compact' ? 22 : 48));
        const model = buildWatch(config, lib, {
          quality: 'fallback',
          layers: ['case', 'rehaut', 'crystal', 'hands', 'seconds'],
        });
        model.root.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          expect(Array.from(o.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(
            true,
          );
          expect(Array.from(o.geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(
            true,
          );
        });
        model.dispose();
      }
    lib.dispose();
  },
  20_000,
);
