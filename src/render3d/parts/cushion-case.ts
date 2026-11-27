/** Machined cushion: separate back, midcase and bezel. All dimensions in mm. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WatchConfig } from '../../core/config/types';
import type { WatchDimensions } from '../../core/geometry/dimensions';
import { buildRuns, type ProfileRun } from '../lathe';
import type { MaterialLibrary } from '../materials';
import {
  caseLevels,
  metricLatheUV,
  shapeAperture,
  shapeLathe,
  smoothLatheTangents,
} from './levels';
import { applyOcclusion, caseOcclusion } from './occlusion';
import type { CaseParts } from './case';
import { bezelTypeForConfig, independentBezel } from '../../core/config/bezel';
import { bezelProfile, bezelSegments, machineBezel } from './bezel';
import { effectiveRehautProfile } from '../../core/config/rehaut';
import { buildWideRehaut } from './rehaut';
import { caseProfileRuns } from './case-profile';

type Surface = 'brushed' | 'polished' | 'joint';

export function buildCushionCase(
  config: WatchConfig,
  d: WatchDimensions,
  lib: MaterialLibrary,
  buildBody = true,
): CaseParts {
  const { R, T, c, flankTop, seat, rehautTop } = caseLevels(d);
  const zb = d.z.back;
  const zt = d.z.bezelTop;
  const Ro = d.openingRadius;
  const backJoin = zb + T * 0.085;
  const gap = Math.min(0.06, T * 0.006);
  const side = R - c * 0.6;
  const runs: ProfileRun<Surface>[] = [
    // Closed flat caseback, inset from the midcase; no artificial circular ridge.
    {
      surface: 'brushed',
      points: [
        [0, zb],
        [R - c * 1.9, zb],
      ],
    },
    {
      surface: 'polished',
      points: [
        [R - c * 1.9, zb],
        [R - c, zb + 0.25],
        [R - c, backJoin - gap],
      ],
    },
    {
      surface: 'joint',
      points: [
        [R - c, backJoin - gap],
        [R - c, backJoin],
      ],
    },
    {
      surface: 'polished',
      points: [
        [R - c, backJoin],
        [side, backJoin + 0.18],
      ],
    },
    // Broad flank with restrained convexity, independent of the narrow chamfers.
    {
      surface: 'brushed',
      points: [
        [side, backJoin + 0.18],
        [R - 0.05, backJoin + T * 0.16],
        [R, flankTop - 0.5],
        [R - 0.04, flankTop - 0.26],
      ],
    },
    {
      surface: 'polished',
      points: [
        [R - 0.04, flankTop - 0.26],
        [side, flankTop - gap],
        [R - c * 1.05, flankTop - gap],
      ],
    },
    // Recessed assembly line, 0.06 mm high, hidden under the bezel lip.
    {
      surface: 'joint',
      points: [
        [R - c * 1.05, flankTop - gap],
        [R - c * 1.05, flankTop],
      ],
    },
    {
      surface: 'polished',
      points: [
        [R - c * 1.05, flankTop],
        [side, flankTop],
        [side, zt - c * 0.42],
      ],
    },
    // A flat continuous bevel, with a small edge break rather than a uniform roll.
    {
      surface: 'polished',
      points: [
        [side, zt - c * 0.42],
        [R - c * 0.92, zt - 0.035],
        [R - c, zt],
      ],
    },
    {
      surface: 'brushed',
      points: Array.from({ length: 9 }, (_, i) => {
        const t = i / 8;
        return [R - c + (Ro + c * 0.58 - (R - c)) * t, zt - 0.06 * t];
      }),
    },
    {
      surface: 'polished',
      points: [
        [Ro + c * 0.58, zt - 0.06],
        [Ro + 0.03, seat + 0.09],
        [Ro, seat],
      ],
    },
    {
      surface: 'brushed',
      points: [
        [Ro, seat],
        [Ro, rehautTop],
      ],
    },
  ];
  const group = new THREE.Group();
  const bezelType = independentBezel(config) ? 'rotating' : bezelTypeForConfig(config);
  const customBezel = bezelProfile(bezelType, d, [R - c * 1.05, flankTop]);
  if (customBezel) runs.splice(7, runs.length - 7, ...customBezel);
  const midcase = caseProfileRuns(config.case.profile, d, true);
  if (midcase) runs.splice(3, 4, ...midcase);
  group.name = 'case';
  const occlusion = caseOcclusion(config, d);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const mesh of buildRuns(
    buildBody ? runs : [],
    (s) => (s === 'joint' ? lib.matte('#303238') : lib.caseMetal(config, s, true)),
    (run) => bezelSegments(bezelType, run.points, d),
  )) {
    machineBezel(mesh.geometry, bezelType, d);
    shapeLathe(mesh.geometry, d, config.case.shape, bezelType !== 'smooth', !!midcase);
    metricLatheUV(mesh.geometry, R);
    smoothLatheTangents(mesh.geometry, (mesh.geometry as THREE.LatheGeometry).parameters.segments);
    if (mesh.name !== 'joint') applyOcclusion(mesh.geometry, occlusion);
    const material = mesh.material as THREE.Material;
    const batch = batches.get(material) ?? [];
    batch.push(mesh.geometry);
    batches.set(material, batch);
  }

  for (const [material, geometries] of batches) {
    group.add(new THREE.Mesh(mergeGeometries(geometries), material));
    geometries.forEach((geometry) => geometry.dispose());
  }

  if (effectiveRehautProfile(config) !== 'classic')
    return { case: group, rehaut: buildWideRehaut(config, d, lib) };

  const rehaut = new THREE.Group();
  rehaut.name = 'rehaut';
  const rehautRuns: ProfileRun<'wall' | 'lip'>[] = [
    {
      surface: 'wall',
      points: [
        [Ro, rehautTop],
        [d.dialRadius + 0.12, 0.16],
        [d.dialRadius, 0.025],
      ],
    },
    {
      surface: 'lip',
      points: [
        [d.dialRadius, 0.025],
        [d.dialRadius - 0.09, 0.025],
      ],
    },
  ];
  for (const mesh of buildRuns(
    rehautRuns,
    (s) => (s === 'wall' ? lib.rehaut(config) : lib.caseMetal(config, 'polished')),
    160,
  )) {
    shapeAperture(mesh.geometry, d);
    if (mesh.name === 'wall')
      applyOcclusion(mesh.geometry, (_x, _y, z) => 0.65 + 0.35 * Math.max(0, z / rehautTop));
    rehaut.add(mesh);
  }
  return { case: group, rehaut };
}
