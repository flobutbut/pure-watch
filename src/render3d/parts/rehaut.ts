/** Wide rehaut profiles; classic geometry stays in the original case builders. */
import * as THREE from 'three';
import { effectiveRehautProfile, effectiveRehautScale } from '../../core/config/rehaut';
import type { WatchConfig } from '../../core/config/types';
import type { WatchDimensions } from '../../core/geometry/dimensions';
import { rehautPrintExtent, rehautPrintSvg } from '../../render2d/rehaut-print';
import { latheZ, type P2 } from '../lathe';
import type { MaterialLibrary } from '../materials';
import { sharpPrint, svgTexture } from '../textures';
import { caseLevels, metricLatheUV, shapeAperture } from './levels';
import { applyOcclusion } from './occlusion';

export function rehautProfile(config: WatchConfig, d: WatchDimensions): P2[] {
  const kind = effectiveRehautProfile(config);
  const { rehautTop } = caseLevels(d);
  const bottom = 0.025;
  return Array.from({ length: 25 }, (_, i) => {
    const t = i / 24;
    const height =
      kind === 'concave' ? (1 - t) ** 2 : kind === 'stepped' ? Math.max(0, 1 - t / 0.4) : 1 - t;
    return [
      d.openingRadius + (d.dialRadius - d.openingRadius) * t,
      bottom + (rehautTop - bottom) * height,
    ];
  });
}

export function buildWideRehaut(
  config: WatchConfig,
  d: WatchDimensions,
  lib: MaterialLibrary,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'rehaut';
  const geometry = latheZ(rehautProfile(config, d), 192);
  shapeAperture(geometry, d);
  metricLatheUV(geometry, d.openingRadius);
  const { rehautTop } = caseLevels(d);
  applyOcclusion(geometry, (_x, _y, z) => 0.7 + 0.3 * Math.max(0, z / rehautTop));
  group.add(new THREE.Mesh(geometry, lib.rehaut(config)));
  return group;
}

/** Owns the decal material and texture, not the shared physical surface material. */
export function decorateRehaut(
  group: THREE.Object3D,
  config: WatchConfig,
  d: WatchDimensions,
  size = 2048,
) {
  const owned: { dispose(): void }[] = [];
  if (effectiveRehautScale(config) === 'none') return { ready: Promise.resolve(), owned };
  const geometry = latheZ(rehautProfile(config, d), 192);
  shapeAperture(geometry, d);
  const p = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const span = 2 * rehautPrintExtent(d);
  for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / span, 0.5 + p.getY(i) / span);
  uv.needsUpdate = true;
  const { texture, ready } = svgTexture(rehautPrintSvg(config, d), size);
  const material = sharpPrint(
    new THREE.MeshStandardMaterial({
      map: texture,
      alphaTest: 0.35,
      roughness: 0.7,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'rehaut-graduations';
  mesh.position.z = 0.009;
  group.add(mesh);
  owned.push(texture, material);
  return { ready, owned };
}
