import * as THREE from 'three';
import { bezelShape, bezelMetalConfig, bezelTypeForConfig } from '../../core/config/bezel';
import { caseConstruction } from '../../core/config/case-construction';
import type { WatchConfig } from '../../core/config/types';
import { shapeRadius } from '../../core/geometry/case-shape';
import type { WatchDimensions } from '../../core/geometry/dimensions';
import { buildRuns, type P2, type ProfileRun } from '../lathe';
import type { MaterialLibrary } from '../materials';
import { machineBezel } from './bezel';
import { bezelOutline, caseLevels, metricLatheUV, smoothLatheTangents } from './levels';

/** Independent exterior contour with a separate aperture; never deforms the midcase. */
export function buildIndependentBezel(
  config: WatchConfig,
  d: WatchDimensions,
  lib: MaterialLibrary,
) {
  const group = new THREE.Group();
  group.name = 'independent-bezel';
  const type = bezelTypeForConfig(config),
    shape = bezelShape(config);
  const { c } = caseLevels(d);
  const inner = d.openingRadius + 0.285;
  const aperture = (angle: number) => inner * d.dialScale * shapeRadius(d.dialShape, angle);
  // Set back from the case edge and seated on the deck (see bezelOutline).
  const outline = bezelOutline(d, config.case.shape, shape, aperture, 0.6);
  // The profile is drawn at the ring's narrowest width, then stretched to the outline.
  let narrowest = Infinity;
  for (let i = 0; i < 256; i++) {
    const angle = (i * Math.PI) / 128;
    narrowest = Math.min(narrowest, outline.perimeter(angle) - aperture(angle));
  }
  const outer = inner + narrowest;
  const bottom = outline.bottom;
  const top = d.z.bezelTop - 0.045;
  const bevel = Math.min(c * 0.3, (outer - inner) * 0.15);
  // The outer top edge follows the case's edge treatment (sharp, chamfer or rounded),
  // limited by the ring's width and height.
  const settings = caseConstruction(config);
  const edge = Math.min(
    settings.edge === 'sharp' ? 0.01 : settings.edgeSizeMm,
    (outer - inner) * 0.35,
    (top - bottom) * 0.45,
  );
  // Rounded and stepped rings start their top one bevel lower.
  const cornerTop = type === 'rounded' || type === 'stepped' ? top - bevel : top;
  const left: P2 = [outer - edge, cornerTop];
  const right: P2 = [inner + bevel, top - bevel];
  const wall: P2[] = [
    [outer - bevel, bottom],
    [outer, bottom + bevel],
    [outer, cornerTop - edge],
  ];
  const runs: ProfileRun<'brushed' | 'polished'>[] = [
    {
      surface: 'brushed',
      points: [
        [inner, bottom],
        [outer - bevel, bottom],
      ],
    },
  ];
  if (settings.edge === 'rounded') {
    // A quarter round continues the wall's run, so its shading flows into the flank.
    const arc = Array.from({ length: 8 }, (_, i) => {
      const a = ((i + 1) / 8) * (Math.PI / 2);
      return [outer - edge + edge * Math.cos(a), cornerTop - edge + edge * Math.sin(a)] as P2;
    });
    runs.push({ surface: 'polished', points: [...wall, ...arc] });
  } else
    runs.push(
      { surface: 'polished', points: wall },
      { surface: 'polished', points: [wall[wall.length - 1]!, left] },
    );
  if (type === 'rounded') {
    runs.push({
      surface: 'polished',
      points: Array.from({ length: 25 }, (_, i) => {
        const t = i / 24;
        return [left[0] + (right[0] - left[0]) * t, top - bevel * (2 * t - 1) ** 2] as P2;
      }),
    });
  } else if (type === 'stepped') {
    const mid = (left[0] + right[0]) / 2;
    runs.push(
      { surface: 'brushed', points: [left, [mid, top - bevel]] },
      {
        surface: 'polished',
        points: [
          [mid, top - bevel],
          [mid - bevel, top],
        ],
      },
      { surface: 'brushed', points: [[mid - bevel, top], [right[0], top], right] },
    );
  } else
    runs.push(
      {
        surface: 'brushed',
        points: [left, [inner + 2 * bevel, top]],
      },
      { surface: 'polished', points: [[inner + 2 * bevel, top], right] },
    );
  runs.push({ surface: 'polished', points: [right, [inner, top - 2 * bevel], [inner, bottom]] });
  const metal = bezelMetalConfig(config);
  const segments = ['fluted', 'coin', 'notched'].includes(type) ? 576 : 192;
  const ringD = { ...d, caseRadius: outer, openingRadius: inner, bezelWidth: outer - inner };
  for (const mesh of buildRuns(runs, (s) => lib.caseMetal(metal, s), segments)) {
    machineBezel(mesh.geometry, type, ringD);
    const p = mesh.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        r = Math.hypot(x, y),
        angle = Math.atan2(y, x);
      const from = aperture(angle);
      const radius = from + ((r - inner) / (outer - inner)) * (outline.perimeter(angle) - from);
      p.setXY(i, (x * radius) / r, (y * radius) / r);
    }
    p.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    metricLatheUV(mesh.geometry, outer);
    smoothLatheTangents(mesh.geometry, segments);
    group.add(mesh);
  }
  return group;
}
