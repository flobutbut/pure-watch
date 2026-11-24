/**
 * Boîtier rond paramétrique : fond, carrure, lunette lisse, rehaut (spec §9.4).
 * Tout est généré depuis les dimensions : un seul code pour 22 à 48 mm.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WatchConfig } from '../../core/config/types';
import type { WatchDimensions } from '../../core/geometry/dimensions';
import { caseLevels, metricLatheUV, shapeAperture, shapeLathe } from './levels';
import { applyOcclusion, caseOcclusion } from './occlusion';
import { arc, buildRuns, type P2, type ProfileRun } from '../lathe';
import type { MaterialLibrary } from '../materials';
import { bezelTypeForConfig, independentBezel } from '../../core/config/bezel';
import { bezelProfile, bezelSegments, machineBezel } from './bezel';
import { effectiveRehautProfile } from '../../core/config/rehaut';
import { buildWideRehaut } from './rehaut';
import { caseProfileRuns } from './case-profile';

type CaseSurface = 'brushed' | 'polished' | 'joint';

export interface CaseParts {
  case: THREE.Group;
  rehaut: THREE.Group;
}

export function buildCase(
  config: WatchConfig,
  d: WatchDimensions,
  lib: MaterialLibrary,
  instrument = false,
): CaseParts {
  const { R, T, c, flankTop, seat, rehautTop } = caseLevels(d);
  const zb = d.z.back;
  const zt = d.z.bezelTop;
  const Ro = d.openingRadius;
  const Rcb = R * 0.8;

  // Fond de boîte légèrement bombé.
  const back: P2[] = [
    [0, zb - 0.035 * T],
    [Rcb * 0.55, zb - 0.032 * T],
    [Rcb * 0.88, zb - 0.02 * T],
    [Rcb, zb],
  ];

  // Carrure : flanc légèrement galbé entre deux chanfreins polis.
  const flankStart: P2 = [R - c * 0.6, zb + c * 1.2];
  const flankEnd: P2 = [R - c * 0.6, flankTop];
  const flank: P2[] = [flankStart];
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    flank.push([
      R - c * 0.6 + c * 0.6 * Math.sin(Math.PI * t),
      flankStart[1] + (flankEnd[1] - flankStart[1]) * t,
    ]);
  }

  // Lunette lisse : flanc poli qui s'arrondit vers un dessus brossé circulaire.
  const bezelSideStart: P2 = [R - c * 1.6, flankTop + c * 0.9];
  const bezelShoulder: P2 = [R - c * 2.0, zt - c * 0.7];
  const bezelTopOuter: P2 = [R - c * 2.8, zt];
  const bezelTopInner: P2 = [Ro + c * 1.2, zt - 0.012 * T];
  const innerChamferEnd: P2 = [Ro, seat];

  const runs: ProfileRun<CaseSurface>[] = [
    {
      surface: 'brushed',
      points: [
        [Rcb, zb],
        [R - c * 2.2, zb],
      ],
    },
    { surface: 'polished', points: [[R - c * 2.2, zb], flankStart] },
    { surface: 'brushed', points: flank },
    { surface: 'polished', points: [flankEnd, bezelSideStart] },
    {
      surface: 'polished',
      points: [bezelSideStart, bezelShoulder, ...arc(bezelShoulder, bezelTopOuter, c * 0.35, 8)],
    },
    { surface: 'brushed', points: [bezelTopOuter, bezelTopInner] },
    { surface: 'polished', points: [bezelTopInner, innerChamferEnd] },
    // Paroi intérieure, sous le cristal.
    { surface: 'brushed', points: [innerChamferEnd, [Ro, rehautTop]] },
  ];

  if (instrument) {
    const [r, z] = bezelSideStart;
    // Satin shoulder, recessed 0.05 mm assembly line, then a small polished edge.
    runs.splice(
      3,
      2,
      { surface: 'brushed', points: [flankEnd, [r + 0.08, z - 0.1]] },
      {
        surface: 'polished',
        points: [
          [r + 0.08, z - 0.1],
          [r - 0.06, z - 0.05],
        ],
      },
      {
        surface: 'joint',
        points: [
          [r - 0.06, z - 0.05],
          [r - 0.06, z],
        ],
      },
      {
        surface: 'polished',
        points: [
          [r - 0.06, z],
          bezelSideStart,
          bezelShoulder,
          [bezelTopOuter[0] + 0.08, zt - 0.06],
          bezelTopOuter,
        ],
      },
    );
  }
  const bezelType = independentBezel(config) ? 'rotating' : bezelTypeForConfig(config);
  const customBezel = bezelProfile(bezelType, d, flankEnd);
  if (customBezel) runs.splice(3, runs.length - 3, ...customBezel);
  const midcase = caseProfileRuns(config.case.profile, d);
  if (midcase) runs.splice(1, 2, ...midcase);
  const metal = (surface: CaseSurface) =>
    surface === 'joint' ? lib.matte('#090B0E') : lib.caseMetal(config, surface, true);
  const caseGroup = new THREE.Group();
  caseGroup.name = 'case';
  // Ombre douce autour de la racine des cornes et du tube de couronne.
  const occlusion = caseOcclusion(config, d);
  for (const mesh of buildRuns(runs, metal, (run) => bezelSegments(bezelType, run.points, d))) {
    machineBezel(mesh.geometry, bezelType, d);
    shapeLathe(mesh.geometry, d, config.case.shape, bezelType !== 'smooth', !!midcase);
    metricLatheUV(mesh.geometry, R);
    applyOcclusion(mesh.geometry, occlusion);
    caseGroup.add(mesh);
  }
  for (const mesh of buildRuns([{ surface: 'brushed' as const, points: back }], (s) =>
    lib.caseMetal(config, s, true),
  )) {
    shapeLathe(mesh.geometry, d, config.case.shape, false, !!midcase);
    metricLatheUV(mesh.geometry, R);
    applyOcclusion(mesh.geometry, occlusion);
    caseGroup.add(mesh);
  }

  if (instrument) {
    // Batch the finish zones: three draws for the whole case, including its joint.
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const object of [...caseGroup.children]) {
      const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
      const batch = batches.get(mesh.material) ?? [];
      batch.push(mesh.geometry);
      batches.set(mesh.material, batch);
      caseGroup.remove(mesh);
    }
    for (const [material, geometries] of batches) {
      caseGroup.add(new THREE.Mesh(mergeGeometries(geometries), material));
      geometries.forEach((g) => g.dispose());
    }
  }

  if (effectiveRehautProfile(config) !== 'classic')
    return { case: caseGroup, rehaut: buildWideRehaut(config, d, lib) };

  // Rehaut : anneau incliné de l'ouverture de lunette jusqu'au bord du cadran.
  const rehautGroup = new THREE.Group();
  rehautGroup.name = 'rehaut';
  const rehautPoints: P2[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    rehautPoints.push([Ro + (d.dialRadius - Ro) * t, rehautTop + (0.01 - rehautTop) * t]);
  }
  for (const mesh of buildRuns([{ surface: 'rehaut' as const, points: rehautPoints }], () =>
    lib.rehaut(config),
  )) {
    shapeAperture(mesh.geometry, d);
    // Le pied du rehaut, contre le cadran, reçoit moins de lumière.
    applyOcclusion(mesh.geometry, (_x, _y, z) => {
      const t = Math.max(0, Math.min(1, (z - 0.01) / (rehautTop - 0.01)));
      return 0.55 + 0.45 * t ** 0.7;
    });
    rehautGroup.add(mesh);
  }

  return { case: caseGroup, rehaut: rehautGroup };
}

export { caseLevels } from './levels';
