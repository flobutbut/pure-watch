/**
 * Outils de profils de révolution. Un profil est une suite de points (r, z) en mm ;
 * il est découpé en tronçons qui portent chacun leur matière (flanc brossé, chanfrein poli…).
 * Chaque tronçon devient une LatheGeometry séparée : l'arête entre deux tronçons reste
 * vive, ce qui fait briller les chanfreins.
 *
 * Sens de parcours : de l'arrière vers l'avant par l'extérieur, puis vers l'axe.
 * C'est ce sens qui oriente les normales vers l'extérieur.
 */
import * as THREE from 'three';

export type P2 = readonly [r: number, z: number];

export interface ProfileRun<K extends string> {
  surface: K;
  points: P2[];
}

/** Révolution autour de l'axe Z (l'axe de la montre). */
export function latheZ(points: readonly P2[], segments = 192): THREE.BufferGeometry {
  const geometry = new THREE.LatheGeometry(
    points.map(([r, z]) => new THREE.Vector2(Math.max(0, r), z)),
    segments,
  );
  // LatheGeometry tourne autour de Y : on bascule Y → Z.
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

/** Points d'un arc de raccord entre deux points, bombé vers `bulge` (0 = segment droit). */
export function arc(from: P2, to: P2, bulge: number, steps = 6): P2[] {
  const out: P2[] = [];
  const [r0, z0] = from;
  const [r1, z1] = to;
  // Normale au segment, orientée vers l'extérieur du profil (à droite du sens de parcours).
  const dr = r1 - r0;
  const dz = z1 - z0;
  const len = Math.hypot(dr, dz) || 1;
  const nr = dz / len;
  const nz = -dr / len;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const lift = Math.sin(Math.PI * t) * bulge;
    out.push([r0 + dr * t + nr * lift, z0 + dz * t + nz * lift]);
  }
  return out;
}

/** Construit les maillages d'un profil découpé en tronçons. */
export function buildRuns<K extends string>(
  runs: readonly ProfileRun<K>[],
  materialFor: (surface: K) => THREE.Material,
  segments = 192,
): THREE.Mesh[] {
  return runs
    .filter((run) => run.points.length >= 2)
    .map((run) => {
      const mesh = new THREE.Mesh(latheZ(run.points, segments), materialFor(run.surface));
      mesh.name = run.surface;
      return mesh;
    });
}
