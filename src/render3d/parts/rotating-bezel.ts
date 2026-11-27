import * as THREE from 'three';
import type { WatchConfig } from '../../core/config/types';
import { bezelAngle, bezelMetalConfig } from '../../core/config/bezel';
import { caseConstruction } from '../../core/config/case-construction';
import type { WatchDimensions } from '../../core/geometry/dimensions';
import { bezelPrintSvg } from '../../render2d/bezel-print';
import { buildRuns, type ProfileRun } from '../lathe';
import type { MaterialLibrary } from '../materials';
import { sharpPrint, svgTexture } from '../textures';
import { bezelOutline, caseLevels, metricLatheUV } from './levels';

export function rotatingBezelDimensions(config: WatchConfig, d: WatchDimensions) {
  const { c } = caseLevels(d);
  // The glass shell extends 0.25 mm beyond the visible aperture.
  const inner = d.openingRadius + 0.285;
  // A graduated insert keeps at least 0.9 mm of print, even on small cases.
  const minRing = c * 0.18 + 0.9 + c * 0.36;
  // Set back from the case edge like every bezel: a circle inscribed in the landing.
  const outline = bezelOutline(d, config.case.shape, 'round', () => inner, minRing);
  let circle = Infinity;
  for (let i = 0; i < 256; i++) circle = Math.min(circle, outline.perimeter((i * Math.PI) / 128));
  const outer = Math.max(Math.min(circle, d.openingRadius + d.bezelWidth - 0.15), inner + minRing);
  return {
    outer,
    inner,
    insertOuter: outer - c * 0.36,
    insertInner: inner + c * 0.18,
    bottom: outline.bottom,
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
  const metalConfig = bezelMetalConfig(config);
  group.name = rotating ? 'rotating-bezel' : 'fixed-bezel';
  const { outer, inner, insertOuter, insertInner, bottom, top } = rotatingBezelDimensions(
    config,
    d,
  );
  // The outer top edge follows the case's edge treatment, within the narrow metal rim
  // left around the printed insert.
  const settings = caseConstruction(config);
  const edge = Math.min(
    settings.edge === 'sharp' ? 0.01 : settings.edgeSizeMm,
    (outer - insertOuter) * 0.9,
    (top - bottom) * 0.45,
  );
  const wall: [number, number][] = [
    [outer - 0.12, bottom],
    [outer, bottom + 0.08],
    [outer, top - edge],
  ];
  const rim: ProfileRun<'brushed' | 'polished'>[] =
    settings.edge === 'rounded'
      ? [
          {
            surface: 'polished',
            points: [
              ...wall,
              ...Array.from({ length: 8 }, (_, i) => {
                const a = ((i + 1) / 8) * (Math.PI / 2);
                return [outer - edge + edge * Math.cos(a), top - edge + edge * Math.sin(a)] as [
                  number,
                  number,
                ];
              }),
              [insertOuter, top],
            ],
          },
        ]
      : [
          { surface: 'polished', points: wall },
          {
            surface: 'polished',
            points: [
              [outer, top - edge],
              [outer - edge, top],
            ],
          },
          {
            surface: 'polished',
            points: [
              [outer - edge, top],
              [insertOuter, top],
            ],
          },
        ];
  const runs: ProfileRun<'brushed' | 'polished'>[] = [
    {
      surface: 'brushed',
      points: [
        [inner, bottom],
        [outer - 0.12, bottom],
      ],
    },
    ...rim,
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
    (surface) => lib.caseMetal(metalConfig, surface),
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
