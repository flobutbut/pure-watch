import * as THREE from 'three';
import type { WatchConfig } from '../../core/config/types';
import { bezelAngle } from '../../core/config/bezel';
import { contourExtents } from '../../core/geometry/dial-shape';
import type { WatchDimensions } from '../../core/geometry/dimensions';
import { bezelPrintSvg } from '../../render2d/bezel-print';
import { buildRuns, type ProfileRun } from '../lathe';
import type { MaterialLibrary } from '../materials';
import { sharpPrint, svgTexture } from '../textures';
import { caseLevels, metricLatheUV } from './levels';

export function rotatingBezelDimensions(config: WatchConfig, d: WatchDimensions) {
  const { c, seat } = caseLevels(d);
  const outer = Math.min(
    d.caseRadius * contourExtents(config.case.shape).min - 0.15,
    d.openingRadius + d.bezelWidth - 0.15,
  );
  return {
    outer,
    // The glass shell extends 0.25 mm beyond the visible aperture.
    inner: d.openingRadius + 0.285,
    insertOuter: outer - c * 0.36,
    insertInner: d.openingRadius + 0.285 + c * 0.18,
    bottom: seat + 0.035,
    top: d.z.bezelTop - 0.045,
  };
}

/** A separate circular insert. Only the rotating variant has grip cuts and an adjustable angle. */
export function buildGraduatedBezel(
  config: WatchConfig,
  d: WatchDimensions,
  lib: MaterialLibrary,
  size = 2048,
) {
  const group = new THREE.Group();
  const rotating = config.bezel.type === 'rotating';
  group.name = rotating ? 'rotating-bezel' : 'fixed-bezel';
  const { outer, inner, insertOuter, insertInner, bottom, top } = rotatingBezelDimensions(
    config,
    d,
  );
  const runs: ProfileRun<'brushed' | 'polished'>[] = [
    {
      surface: 'brushed',
      points: [
        [inner, bottom],
        [outer - 0.12, bottom],
      ],
    },
    {
      surface: 'polished',
      points: [
        [outer - 0.12, bottom],
        [outer, bottom + 0.08],
        [outer, top - 0.1],
        [outer - 0.08, top],
        [insertOuter, top],
      ],
    },
    {
      surface: 'polished',
      points: [
        [insertInner, top],
        [inner, top - 0.08],
        [inner, bottom],
      ],
    },
  ];
  for (const mesh of buildRuns(
    runs,
    (surface) => lib.caseMetal(config, surface),
    rotating ? 720 : 192,
  )) {
    const p = mesh.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getY(i));
      if (!rotating || r < outer - 0.025 || p.getZ(i) > top - 0.09) continue;
      const cut = 0.09 * (0.5 + 0.5 * Math.cos(120 * Math.atan2(p.getY(i), p.getX(i)))) ** 2;
      p.setXY(i, (p.getX(i) * (r - cut)) / r, (p.getY(i) * (r - cut)) / r);
    }
    p.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    metricLatheUV(mesh.geometry, outer);
    group.add(mesh);
  }
  const insert = new THREE.RingGeometry(insertInner, insertOuter, 360);
  const face = new THREE.Mesh(insert, lib.lacquer(config.bezel.color));
  face.name = 'bezel-insert';
  face.position.z = top - 0.012;
  group.add(face);
  const owned: { dispose(): void }[] = [];
  let ready = Promise.resolve();
  // Geometry tests run without a DOM; browser renders always build the printed insert.
  if (typeof document !== 'undefined') {
    const { texture, ready: textureReady } = svgTexture(
      bezelPrintSvg(config, insertInner, insertOuter),
      size,
    );
    const material = sharpPrint(
      new THREE.MeshStandardMaterial({
        map: texture,
        alphaTest: 0.35,
        roughness: 0.65,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    );
    const geometry = insert.clone();
    const p = geometry.getAttribute('position'),
      uv = geometry.getAttribute('uv');
    const extent = insertOuter * 1.01;
    for (let i = 0; i < p.count; i++)
      uv.setXY(i, 0.5 + p.getX(i) / (2 * extent), 0.5 + p.getY(i) / (2 * extent));
    uv.needsUpdate = true;
    const print = new THREE.Mesh(geometry, material);
    print.name = 'bezel-graduations';
    print.position.z = top - 0.003;
    group.add(print);
    owned.push(texture, material);
    ready = textureReady;
  }
  const setAngle = (angle: number) => {
    if (rotating) group.rotation.z = (-bezelAngle(angle) * Math.PI) / 180;
  };
  setAngle(config.bezel.angleDeg);
  return { group, ready, owned, setAngle };
}
