/** Cristal : calotte sphérique (plat, bombé ou « boîte ») posée sous le bord de la lunette. */
import * as THREE from 'three';
import type { WatchConfig } from '../../core/config/types';
import type { WatchDimensions } from '../../core/geometry/dimensions';
import { latheZ, type P2 } from '../lathe';
import type { CrystalQuality, MaterialLibrary } from '../materials';
import { shapeRadius } from '../../core/geometry/case-shape';
import { buildCyclops } from './date';
import { caseLevels, shapeAperture } from './levels';

export function buildCrystal(
  config: WatchConfig,
  d: WatchDimensions,
  lib: MaterialLibrary,
  quality: CrystalQuality,
  refined = false,
): THREE.Group {
  const { seat } = caseLevels(d);
  const Rc = d.openingRadius + 0.25;
  const zEdge = seat + 0.05;
  const h = Math.max(0.02, d.z.crystalTop - zEdge);

  // Du bord vers l'axe : normales vers l'avant.
  const points: P2[] = [
    [Rc, zEdge - 0.6],
    [Rc, zEdge],
  ];
  const sphere = (Rc * Rc + h * h) / (2 * h);
  const steps = 32;
  for (let i = 1; i <= steps; i++) {
    const r = Rc * (1 - i / steps);
    points.push([r, zEdge + h - (sphere - Math.sqrt(sphere * sphere - r * r))]);
  }

  let profile = points;
  if (refined) {
    const flat = config.crystal.type === 'sapphire-flat' || config.crystal.type === 'mineral';
    const box = config.crystal.type === 'sapphire-box';
    const top = d.z.crystalTop;
    const thickness = Math.min(0.7, d.caseThickness * 0.065);
    // Closed shell, with an underside and a small polished edge break.
    const upper: P2[] = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const r = Rc * (1 - i / steps);
      const z = flat
        ? top
        : box
          ? top - 0.35 * (r / Rc) ** 6
          : zEdge + h - (sphere - Math.sqrt(sphere * sphere - r * r));
      upper.push([r, z]);
    }
    const lower: P2[] = upper
      .map(
        ([r, z]) =>
          [r, box ? zEdge - Math.min(0.25, d.caseThickness * 0.022) : z - thickness] as P2,
      )
      .reverse();
    const edge = upper[0]!;
    profile = [...lower, [Rc, edge[1] - 0.08], [Rc - 0.06, edge[1]], ...upper.slice(1)];
  }
  const mesh = new THREE.Mesh(latheZ(profile, refined ? 128 : 160), lib.crystal(config, quality));
  shapeAperture(mesh.geometry, d);
  mesh.renderOrder = 10; // après les pièces opaques (repli transparent)
  const group = new THREE.Group();
  group.name = 'crystal';
  group.add(mesh);

  // Dessus du verre au-dessus d'un point du cadran (contour déformé compris).
  const surfaceZ = (x: number, y: number) => {
    const k =
      d.dialShape === 'round' ? 1 : d.dialScale * shapeRadius(d.dialShape, Math.atan2(y, x));
    const r = Math.min(Rc, Math.hypot(x, y) / k);
    const dome = zEdge + h - (sphere - Math.sqrt(sphere * sphere - r * r));
    if (!refined) return dome;
    if (config.crystal.type === 'sapphire-flat' || config.crystal.type === 'mineral')
      return d.z.crystalTop;
    if (config.crystal.type === 'sapphire-box') return d.z.crystalTop - 0.35 * (r / Rc) ** 6;
    return dome;
  };
  const cyclops = buildCyclops(config, d, lib.crystal(config, quality), surfaceZ);
  if (cyclops) group.add(cyclops);

  // Joint sombre entre le verre et la lunette : souligne le sertissage.
  const gasket = new THREE.Mesh(
    latheZ(
      [
        [d.openingRadius + 0.05, zEdge - 0.25],
        [d.openingRadius - 0.28, zEdge - 0.12],
        [d.openingRadius - 0.3, zEdge + 0.02],
      ],
      160,
    ),
    lib.matte('#0b0c0e'),
  );
  shapeAperture(gasket.geometry, d);
  group.add(gasket);
  return group;
}
