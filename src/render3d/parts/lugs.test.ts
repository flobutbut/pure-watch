import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../core/config/defaults';
import { CASE_SHAPES } from '../../core/geometry/case-shape';
import { proportionsForDiameter, watchDimensions } from '../../core/geometry/dimensions';
import { MaterialLibrary } from '../materials';
import { flankRadiusAt } from './levels';
import { buildLugs, LUG_STYLES, surfaceY } from './lugs';

const styles = LUG_STYLES.filter((s) => s !== 'none');
const cases = [
  ...styles.flatMap((style) => [22, 40, 48].map((d) => [style, d, 'round'] as const)),
  ...styles.flatMap((style) =>
    CASE_SHAPES.filter((s) => s !== 'round').map((shape) => [style, 40, shape] as const),
  ),
];

describe('cornes', () => {
  // Une corne ne doit jamais ressortir du boîtier sous sa jonction avec le flanc :
  // c'est ce qui produisait ailerons, rebords et petits triangles sur la carrure.
  it.each(cases)(
    '%s, %i mm, boîtier %s : reste dans la carrure sous la jonction',
    (style, diameter, shape) => {
      const config = defaultConfig();
      config.case.lugs = style;
      config.case.shape = shape;
      Object.assign(config.case, proportionsForDiameter(diameter));
      const d = watchDimensions(config);
      const surface = flankRadiusAt(d, shape);
      const group = buildLugs(config, d, new MaterialLibrary());
      let worst = -Infinity;
      group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const p = object.geometry.getAttribute('position');
        for (let i = 0; i < p.count; i++) {
          const x = Math.abs(p.getX(i));
          const y = Math.abs(p.getY(i));
          if (y < surfaceY(x, surface) - 0.05) {
            worst = Math.max(worst, Math.hypot(x, y) - surface(Math.atan2(y, x)));
          }
        }
      });
      expect(worst).toBeLessThan(0);
    },
  );

  it('« aucune » ne construit rien', () => {
    const config = defaultConfig();
    config.case.lugs = 'none';
    expect(buildLugs(config, watchDimensions(config), new MaterialLibrary()).children).toHaveLength(
      0,
    );
  });
});
