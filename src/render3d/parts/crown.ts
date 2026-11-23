/**
 * Couronne (spec §5.4) : tube + corps de révolution, six formes, trois positions.
 * Le protège-couronne est modélisé avec la couronne et tourne avec elle.
 */
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WatchConfig } from '../../core/config/types';
import { clamp, type WatchDimensions } from '../../core/geometry/dimensions';
import { crownMount, mountedSurface } from '../../core/geometry/crown-mount';
import type { MaterialLibrary } from '../materials';
import { caseLevels, flankRadiusAt } from './levels';
import { hornGeometry, surfaceY } from './lugs';

type Profile = [r: number, y: number][];

/** Révolution autour de l'axe local Y (le groupe est ensuite orienté vers l'extérieur). */
function latheY(points: Profile, segments: number): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
}

interface Knurl {
  /** Zone striée, le long de l'axe. */
  from: number;
  to: number;
  /** Rayon minimal des sommets concernés. */
  minRadius: number;
  count: number;
  depth: number;
  fade?: boolean;
}

interface CrownDesign {
  profile: (r: number, L: number) => Profile;
  knurl?: (r: number, L: number) => Knurl;
  segments: number;
}

const DESIGNS: Record<string, CrownDesign> = {
  // Cannelée : cylindre à chanfreins, stries de prise.
  fluted: {
    profile: (r, L) => [
      [r * 0.42, 0],
      [r * 0.9, 0],
      [r, L * 0.12],
      [r, L * 0.84],
      [r * 0.9, L],
      [r * 0.55, L],
      [0, L * 1.02],
    ],
    knurl: (r, L) => ({ from: L * 0.1, to: L * 0.86, minRadius: r * 0.95, count: 22, depth: 0.07 }),
    segments: 240,
  },
  // Oignon : bulbe des montres d'aviateur.
  onion: {
    profile: (r, L) => [
      [r * 0.42, 0],
      [r * 0.8, L * 0.06],
      [r * 0.98, L * 0.3],
      [r, L * 0.45],
      [r * 0.93, L * 0.66],
      [r * 0.72, L * 0.86],
      [r * 0.4, L * 0.97],
      [0, L],
    ],
    segments: 96,
  },
  // Pointue : cône effilé, polie (montres habillées, art déco).
  pointed: {
    profile: (r, L) => [
      [r * 0.4, 0],
      [r * 0.82, L * 0.04],
      [r * 0.9, L * 0.22],
      [r * 0.74, L * 0.55],
      [r * 0.42, L * 0.95],
      [r * 0.12, L * 1.3],
      [0, L * 1.36],
    ],
    segments: 96,
  },
  // Carrée : disque large et plat, arêtes vives, face lisse.
  square: {
    profile: (r, L) => [
      [r * 0.4, 0],
      [r * 1.08, 0],
      [r * 1.12, L * 0.06],
      [r * 1.12, L * 0.66],
      [r * 1.06, L * 0.72],
      [0, L * 0.74],
    ],
    knurl: (r, L) => ({
      from: L * 0.08,
      to: L * 0.64,
      minRadius: r * 1.1,
      count: 48,
      depth: 0.025,
    }),
    segments: 240,
  },
  // Pompe : tige fine puis tête cylindrique moletée (inspirée des poussoirs).
  pump: {
    profile: (r, L) => [
      [r * 0.32, 0],
      [r * 0.34, L * 0.38],
      [r * 0.74, L * 0.4],
      [r * 0.8, L * 0.47],
      [r * 0.8, L * 1.02],
      [r * 0.7, L * 1.1],
      [0, L * 1.12],
    ],
    knurl: (r, L) => ({ from: L * 0.48, to: L * 1.0, minRadius: r * 0.78, count: 36, depth: 0.05 }),
    segments: 240,
  },
};
// À protège-couronne : couronne cannelée abritée entre deux ailettes de la carrure.
DESIGNS['guarded'] = DESIGNS['fluted']!;

/** Creuse des stries régulières dans la zone de prise. */
function knurl(geometry: THREE.BufferGeometry, k: Knurl): void {
  const pos = geometry.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const radial = Math.hypot(v.x, v.z);
    if (v.y < k.from || v.y > k.to || radial < k.minRadius) continue;
    const theta = Math.atan2(v.z, v.x);
    const groove = Math.pow(0.5 + 0.5 * Math.cos(k.count * theta), 6);
    const t = (v.y - k.from) / (k.to - k.from);
    const fade = k.fade ? Math.sin(Math.PI * t) ** 2 : 1;
    const s = 1 - k.depth * groove * fade;
    pos.setXYZ(i, v.x * s, v.y, v.z * s);
  }
  geometry.computeVertexNormals();
}

export function buildCrown(
  config: WatchConfig,
  d: WatchDimensions,
  lib: MaterialLibrary,
  refined = false,
): THREE.Group {
  const { R, T } = caseLevels(d);
  const r = d.crown.radius;
  const L = d.crown.length;
  const style = config.crown.style;
  const design =
    refined && style === 'onion' ? CUSHION_ONION : (DESIGNS[style] ?? DESIGNS['fluted']!);
  const bodyRadius = Math.max(...design.profile(r, L).map(([radius]) => radius));

  const lathe = latheY(design.profile(r, L), design.segments);
  if (design.knurl) knurl(lathe, design.knurl(r, L));
  // Arêtes franches entre moletage, chanfreins et face : sinon le lissage étire des
  // traînées rayonnantes sur la face de la couronne.
  lathe.deleteAttribute('uv');
  const body = design.knurl ? toCreasedNormals(lathe, THREE.MathUtils.degToRad(35)) : lathe;
  if (body !== lathe) lathe.dispose();

  const tubeLength = 0.9;
  const tube = new THREE.CylinderGeometry(r * 0.38, r * 0.42, tubeLength + 0.6, 48);
  tube.translate(0, -(tubeLength + 0.6) / 2 + 0.05, 0);

  const material = lib.caseMetal(config, 'jewel');
  const head = new THREE.Group();
  head.add(new THREE.Mesh(body, material), new THREE.Mesh(tube, material));

  // Collerette chanfreinée où le tube sort de la carrure : raccord net, qui accroche la lumière.
  const collar = latheY(
    [
      [r * 0.66, -tubeLength - 0.35],
      [r * 0.66, -tubeLength + 0.08],
      [r * 0.58, -tubeLength + 0.2],
      [r * 0.44, -tubeLength + 0.24],
    ],
    64,
  );
  head.add(new THREE.Mesh(collar, material));

  // Joint sombre entre le tube et la couronne.
  const gasket = new THREE.TorusGeometry(r * 0.44, 0.09, 10, 48);
  gasket.rotateX(Math.PI / 2);
  gasket.translate(0, -0.02, 0);
  head.add(new THREE.Mesh(gasket, lib.matte('#0d0e10')));
  // Axe local Y → +X.
  head.rotation.z = -Math.PI / 2;
  // Sur un boîtier non rond, la couronne se pose là où le flanc se trouve à son angle.
  const mount = crownMount(d, config.case.shape, config.crown.position);
  head.position.x = mount.reach + tubeLength;

  // Pivot autour de l'axe de la montre : 3 h, 4 h ou 2 h.
  const pivot = new THREE.Group();
  pivot.name = 'crown';
  pivot.position.x = mount.x;
  pivot.position.y = mount.y;
  pivot.position.z = d.z.back + 0.48 * T;
  pivot.rotation.z = mount.angle;
  pivot.add(head);

  if (style === 'guarded' || config.crown.guard) {
    // Ailettes : même construction que les cornes (congés tangents au flanc, arêtes
    // arrondies), tournées vers la couronne et limitées à la hauteur du flanc.
    const { c, flankTop } = caseLevels(d);
    const crownZ = pivot.position.z;
    const thickness = clamp(r * 0.45, 1.1, 1.8);
    // Buried roots must also stay below the dial, including a wide shaped aperture.
    const top = Math.min(r * 1.25, flankTop - 0.15 - crownZ, -0.15 - crownZ);
    const bottom = Math.max(-r * 1.25, d.z.back + c * 1.2 + 0.15 - crownZ);
    const band = { top, bottom };
    const material = lib.caseMetal(config, 'satin', true);
    const flankAt = flankRadiusAt(d, config.case.shape);
    for (const sx of [1, -1] as const) {
      const surface = mountedSurface(mount, flankAt, sx);
      const aIn = bodyRadius + 0.3;
      const aOut = aIn + thickness;
      const rootY = Math.min(surfaceY(aIn, surface), surfaceY(aOut, surface));
      const wing = hornGeometry({
        aIn,
        aOut,
        flank: R - c * 0.6 - 0.05,
        // Repère de l'ailette : elle pointe vers +y, puis est tournée vers la couronne.
        surface,
        fillet: clamp(thickness * 0.8, 0.7, 1.4),
        yTip: mount.reach + tubeLength + L * 0.75,
        tipRadius: thickness * 0.45,
        sx,
        sy: 1,
        yStart: rootY - 0.8,
        bevel: clamp(thickness * 0.2, 0.15, 0.35),
        profile: () => band,
        root: band,
      });
      const mesh = new THREE.Mesh(wing, material);
      mesh.rotation.z = -Math.PI / 2; // la pièce pointe vers +y : on l'aligne sur la couronne
      pivot.add(mesh);
    }
  }
  return pivot;
}

export const CROWN_STYLES = Object.keys(DESIGNS);

/** Rounded crown, shallow grip scallops; the original tube and attachment stay fixed. */
const CUSHION_ONION: CrownDesign = {
  profile: (r, L) => {
    const points: Profile = [
      [r * 0.42, 0],
      [r * 0.7, L * 0.04],
    ];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      points.push([
        r * (0.7 + 0.3 * Math.sin(Math.PI * t * 0.95)) * Math.sqrt(1 - t ** 4),
        L * (0.07 + 0.93 * t),
      ]);
    }
    return points;
  },
  knurl: (r, L) => ({
    from: L * 0.17,
    to: L * 0.78,
    minRadius: r * 0.78,
    count: 24,
    depth: 0.014,
    fade: true,
  }),
  segments: 144,
};
