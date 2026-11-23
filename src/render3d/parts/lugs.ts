/**
 * Cornes taillées dans la masse. Une corne est une suite de sections (rectangles aux
 * coins arrondis) posées le long de son axe : largeur, hauteur et arrondi varient
 * d'une section à l'autre (évasement de raccord, effilement, profil droit ou courbe,
 * pointe arrondie). Les sections sont reliées par des bandes régulières : surface lisse,
 * sans grands triangles étirés.
 *
 * Raccord : près de la carrure, le côté s'évase vers l'extérieur jusqu'à rencontrer le
 * flanc, puis rentre juste sous sa surface (partie cachée). Rien ne dépasse du boîtier.
 */
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WatchConfig } from '../../core/config/types';
import { clamp, type WatchDimensions } from '../../core/geometry/dimensions';
import type { MaterialLibrary } from '../materials';
import { caseLevels, flankRadiusAt } from './levels';
import { applyOcclusion, lugRoot } from './occlusion';

export interface HornSpec {
  /** Three contiguous material groups: top, sides, narrow polished bevels. */
  machined?: boolean;
  /** Bande occupée en x (côté intérieur, vers le bracelet ; côté extérieur). */
  aIn: number;
  aOut: number;
  /** Rayon (minimal) du flanc où la pièce s'attache, ampleur de l'évasement. */
  flank: number;
  /** Rayon du flanc selon la direction θ (boîtiers non ronds) ; par défaut `flank`. */
  surface?: (theta: number) => number;
  fillet: number;
  yTip: number;
  tipRadius: number;
  /** Effilement vers la pointe : le côté extérieur rentre, le côté intérieur avance (mm). */
  taper?: { from: number; amount: number; inner?: number };
  /** Signe du quart (corne haut-droite = 1, 1). */
  sx: 1 | -1;
  sy: 1 | -1;
  /** Début de la pièce, à l'intérieur de la carrure (caché). */
  yStart: number;
  /** Rayon des arêtes arrondies. */
  bevel: number;
  /** Segments des arrondis : 1 = chanfrein plat (facette polie), 6 = arrondi. */
  bevelSegments?: number;
  /** Hauteur (z) du dessus et du dessous à une distance y du centre. */
  profile: (y: number) => { top: number; bottom: number };
  /** Hauteur de la racine (z), pour l'ombre de raccord. */
  root: { top: number; bottom: number };
}

/** Profondeur sous la surface du flanc où la partie cachée de la pièce est rangée. */
const HIDDEN_DEPTH = 0.35;

/** Rayon du flanc dans la direction θ. */
function surfaceOf(h: HornSpec): (theta: number) => number {
  return h.surface ?? (() => h.flank);
}

/** Hauteur y (≥ 0) où la verticale x rencontre le flanc. */
export function surfaceY(x: number, surface: (theta: number) => number, offset = 0): number {
  let lo = 0;
  let hi = 200;
  for (let i = 0; i < 40; i++) {
    const y = (lo + hi) / 2;
    if (Math.hypot(x, y) < surface(Math.atan2(y, x)) - offset) lo = y;
    else hi = y;
  }
  return lo;
}

/** Abscisse |x| où l'horizontale y rencontre le flanc (diminué de `offset`), côté `sign`. */
function surfaceX(y: number, sign: 1 | -1, surface: (theta: number) => number, offset: number) {
  let lo = 0;
  let hi = 200;
  for (let i = 0; i < 40; i++) {
    const x = (lo + hi) / 2;
    if (Math.hypot(x, y) < surface(Math.atan2(y, sign * x)) - offset) lo = x;
    else hi = x;
  }
  return lo;
}

/**
 * Côté d'une pièce, en fonction de y. `outward` = sens d'évasement (+1 vers +x).
 *
 * Le congé est une courbe douce qui part du côté droit (P, `fillet` mm avant le flanc) et
 * aboutit exactement sur le flanc (Q, décalé de 0,8 × fillet). Sous Q, la pièce est
 * cachée : elle longe la surface juste en dessous, ou reste en retrait si l'évasement va
 * vers le centre.
 */
function makeSide(a: number, outward: 1 | -1, h: HornSpec): (y: number) => number {
  const surface = surfaceOf(h);
  const w = h.fillet * 0.8;
  const xq = a + outward * w;
  const yq = surfaceY(xq, surface);
  const yp = yq + h.fillet;
  const awayFromCenter = outward * a > 0;
  return (y) => {
    if (y >= yp) return a;
    if (y >= yq) {
      const t = 1 - Math.sqrt((y - yq) / (yp - yq));
      return a + outward * w * t * t;
    }
    if (!awayFromCenter) return xq;
    return outward * surfaceX(y, outward, surface, HIDDEN_DEPTH);
  };
}

function taperProgress(y: number, h: HornSpec): number {
  if (!h.taper) return 0;
  const t = clamp((y - h.taper.from) / (h.yTip - h.taper.from), 0, 1);
  return t * t * (3 - 2 * t);
}

interface Sides {
  inner: (y: number) => number;
  outer: (y: number) => number;
}

/** Section à la distance y : bornes en x (avant le quart sx), bornes en z. */
function section(y: number, h: HornSpec, sides: Sides) {
  const yTop = h.yTip - h.tipRadius;
  const k = taperProgress(y, h);
  const outShift = (h.taper?.amount ?? 0) * k;
  const inShift = (h.taper?.inner ?? 0) * k;
  let x0 = sides.inner(y) + inShift;
  let x1 = sides.outer(y) - outShift;
  if (y > yTop) {
    // Pointe arrondie vue de dessus.
    const r = h.tipRadius;
    const e = r - Math.sqrt(Math.max(0, r * r - (y - yTop) ** 2));
    x0 += e;
    x1 -= e;
  }
  if (x1 - x0 < 0.05) {
    const m = (x0 + x1) / 2;
    x0 = m - 0.025;
    x1 = m + 0.025;
  }
  const { top, bottom } = h.profile(y);
  return { x0, x1, top, bottom };
}

/** Points d'une section (rectangle aux coins arrondis), parcourus dans le même sens. */
function ring(y: number, h: HornSpec, segments: number, sides: Sides): THREE.Vector3[] {
  const { x0, x1, top, bottom } = section(y, h, sides);
  const b = Math.max(0.001, Math.min(h.bevel, (x1 - x0) * 0.48, (top - bottom) * 0.48));
  const corners: [number, number, number][] = [
    [x1 - b, top - b, 0],
    [x0 + b, top - b, Math.PI / 2],
    [x0 + b, bottom + b, Math.PI],
    [x1 - b, bottom + b, (3 * Math.PI) / 2],
  ];
  const pts: THREE.Vector3[] = [];
  for (const [cx, cz, start] of corners) {
    for (let i = 0; i <= segments; i++) {
      const a = start + (i / segments) * (Math.PI / 2);
      pts.push(new THREE.Vector3(cx + b * Math.cos(a), y, cz + b * Math.sin(a)));
    }
  }
  return pts;
}

/**
 * Excroissance de la carrure (corne, ailette de protège-couronne). Repère : la pièce
 * pointe vers +y, puis est placée dans son quart (sx, sy).
 */
export function hornGeometry(h: HornSpec): THREE.BufferGeometry {
  const segments = h.bevelSegments ?? 6;
  const yTop = h.yTip - h.tipRadius;
  const ys: number[] = [];
  for (let y = h.yStart; y < yTop; y += 0.2) ys.push(y);
  for (let i = 0; i <= 10; i++) ys.push(yTop + (i / 10) * h.tipRadius * 0.999);
  const sides: Sides = { inner: makeSide(h.aIn, -1, h), outer: makeSide(h.aOut, 1, h) };
  const rings = ys.map((y) => ring(y, h, segments, sides));

  const buckets = Array.from({ length: h.machined ? 3 : 1 }, () => ({
    positions: [] as number[],
    uvs: [] as number[],
  }));
  let materialIndex = 0;
  const push = (...vs: THREE.Vector3[]) => {
    for (const v of vs) {
      buckets[materialIndex]!.positions.push(v.x * h.sx, v.y * h.sy, v.z);
      // Coordonnées de texture simples (carbone forgé, patine).
      buckets[materialIndex]!.uvs.push(v.x * 0.06, (v.y + v.z) * 0.06);
    }
  };
  // Les sections tournent dans le sens trigonométrique du plan (x, z), donc dans le sens
  // horaire vu depuis la pointe : on inverse les triangles pour orienter les faces vers
  // l'extérieur. Un quart miroir (sx·sy < 0) inverse déjà le sens.
  const flip = h.sx * h.sy > 0;
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
    flip ? push(a, c, b) : push(a, b, c);
  for (let i = 0; i < rings.length - 1; i++) {
    const r0 = rings[i]!;
    const r1 = rings[i + 1]!;
    for (let j = 0; j < r0.length; j++) {
      if (h.machined) materialIndex = j % (segments + 1) < segments ? 2 : j === segments ? 0 : 1;
      const k = (j + 1) % r0.length;
      tri(r0[j]!, r0[k]!, r1[k]!);
      tri(r0[j]!, r1[k]!, r1[j]!);
    }
  }
  // Bout : éventail depuis le centre de la dernière section.
  materialIndex = h.machined ? 1 : 0;
  const last = rings[rings.length - 1]!;
  const center = last.reduce((acc, v) => acc.add(v), new THREE.Vector3()).divideScalar(last.length);
  center.y += 0.02;
  for (let j = 0; j < last.length; j++) tri(last[j]!, last[(j + 1) % last.length]!, center);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      buckets.flatMap((b) => b.positions),
      3,
    ),
  );
  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(
      buckets.flatMap((b) => b.uvs),
      2,
    ),
  );
  let start = 0;
  buckets.forEach((bucket, index) => {
    geometry.addGroup(start, bucket.positions.length / 3, index);
    start += bucket.positions.length / 3;
  });
  // Lisse le long de la pièce et sur les arrondis ; garde les facettes d'un chanfrein.
  const smooth = toCreasedNormals(geometry, THREE.MathUtils.degToRad(segments === 1 ? 30 : 50));
  geometry.dispose();

  // Ombre douce là où la pièce sort de la carrure.
  const surface = surfaceOf(h);
  applyOcclusion(smooth, (x, y, z) => {
    const out = Math.hypot(x, y) - surface(Math.atan2(y * h.sy, x * h.sx));
    const nearRoot = z > h.root.bottom - 0.5 && z < h.root.top + 0.5 ? 1 : 0.6;
    return 1 - 0.38 * nearRoot * Math.exp(-((Math.max(0, out) / 1.0) ** 2));
  });
  return smooth;
}

/* ---------- Styles de cornes (spec §5.1) ---------- */

interface LugStyle {
  /** Hauteur à la pointe, en fraction de l'épaisseur du boîtier au-dessus du fond. */
  tipTop: number;
  tipBottom: number;
  /** Courbure du dessus et du dessous (exposants du profil). */
  topCurve: number;
  bottomCurve: number;
  /** Arêtes : rayon (fraction de l'épaisseur de corne) et segments. */
  bevel: number;
  bevelSegments: number;
  /** Effilement vers la pointe, côté extérieur et intérieur (fraction de l'épaisseur). */
  taper?: number;
  taperInner?: number;
  /** Acier poli (facettes qui accrochent la lumière) au lieu du satiné. */
  polished?: boolean;
  tipRadius?: number;
  /** Trous de barrette visibles sur les flancs (cornes percées). */
  drilled?: boolean;
  /** Bloc unique entre les cornes, très court (bracelet intégré). */
  integrated?: boolean;
}

const STYLES: Record<string, LugStyle> = {
  straight: {
    tipTop: 0.36,
    tipBottom: 0.06,
    topCurve: 1.3,
    bottomCurve: 1.8,
    bevel: 0.16,
    bevelSegments: 6,
    tipRadius: 0.28,
  },
  curved: {
    tipTop: 0.12,
    tipBottom: -0.16,
    topCurve: 1.7,
    bottomCurve: 1.6,
    bevel: 0.16,
    bevelSegments: 6,
    tipRadius: 0.28,
  },
  // Pointues : vue de côté, le dessus plonge en ligne droite vers une pointe fine.
  pointed: {
    tipTop: 0.15,
    tipBottom: 0.07,
    topCurve: 1,
    bottomCurve: 2,
    bevel: 0.14,
    bevelSegments: 6,
    tipRadius: 0.3,
  },
  // Chanfreinées : deux larges facettes polies forment une arête vive sur le dessus.
  faceted: {
    tipTop: 0.32,
    tipBottom: 0.05,
    topCurve: 1.4,
    bottomCurve: 1.8,
    bevel: 0.42,
    bevelSegments: 1,
    tipRadius: 0.3,
    polished: true,
  },
  // Gouttes : section ronde, la corne reste pleine puis s'arrondit en goutte à la pointe.
  teardrop: {
    tipTop: 0.3,
    tipBottom: 0.11,
    topCurve: 2.4,
    bottomCurve: 2,
    bevel: 0.38,
    bevelSegments: 8,
    taper: 0.1,
    taperInner: 0.1,
    tipRadius: 0.4,
  },
  // Percées : cornes droites avec trous de barrette apparents.
  drilled: {
    tipTop: 0.36,
    tipBottom: 0.06,
    topCurve: 1.3,
    bottomCurve: 1.8,
    bevel: 0.14,
    bevelSegments: 6,
    tipRadius: 0.28,
    drilled: true,
  },
  // Intégrées : un bloc court sur toute la largeur, prolongé par le bracelet.
  integrated: {
    tipTop: 0.3,
    tipBottom: 0.08,
    topCurve: 1.2,
    bottomCurve: 1.5,
    bevel: 0.2,
    bevelSegments: 6,
    integrated: true,
  },
};

export const LUG_STYLES = [...Object.keys(STYLES), 'none'];

export function buildLugs(
  config: WatchConfig,
  d: WatchDimensions,
  lib: MaterialLibrary,
  refined = false,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'lugs';
  if (config.case.lugs === 'none') return group; // boîtier sans corne

  const { R, T, c } = caseLevels(d);
  const original = STYLES[config.case.lugs] ?? STYLES['straight']!;
  const machined = refined && ['straight', 'curved', 'drilled'].includes(config.case.lugs);
  // Preserve inside spacing and lug-to-lug. Only the outside tapers, by 0.18 mm.
  const style = machined
    ? { ...original, bevel: 0.085, bevelSegments: 1, taper: 0.07, tipRadius: 0.18 }
    : original;
  const root = lugRoot(d);
  const zb = d.z.back;
  const tipTop = zb + style.tipTop * T;
  const tipBottom = zb + style.tipBottom * T;
  const thickness = d.lugThickness;
  // Boîtiers non ronds : la corne part de là où le flanc se trouve réellement.
  const surface = flankRadiusAt(d, config.case.shape);
  const yFlank = surfaceY(d.lugWidth / 2 + thickness, surface);
  const roundFlank = surfaceY(d.lugWidth / 2 + thickness, () => R - c * 0.6 - 0.05);
  const yJunction = R * 0.9 + (yFlank - roundFlank);
  // Intégrées : bloc court ; sinon pointe au lug-to-lug.
  const yTip = style.integrated
    ? yFlank + clamp(R * 0.14, 2, 3.4)
    : Math.max(d.lugToLug / 2, yFlank + R * 0.2);

  // Profil de côté : la corne s'affine (droite) ou plonge vers le poignet (courbe).
  const profile = (y: number) => {
    const u = clamp((y - yJunction) / (yTip - yJunction), 0, 1);
    const top = root.top + (tipTop - root.top) * u ** style.topCurve;
    const bottom = root.bottom + (tipBottom - root.bottom) * u ** style.bottomCurve;
    return { top, bottom };
  };

  const aIn = style.integrated ? -(d.lugWidth / 2 + thickness) : d.lugWidth / 2;
  const aOut = d.lugWidth / 2 + thickness;
  // L'arrondi d'arête ne doit jamais dépasser la moitié de la largeur ni le rayon de la
  // pointe : sinon le contour intérieur du biseau se retourne.
  const bevel = clamp(thickness * style.bevel, 0.15, Math.min(0.9, thickness * 0.44));
  const tipRadius = Math.max((style.tipRadius ?? 0.38) * thickness, bevel * 1.1);

  // Satiné : la corne n'a pas de coordonnées de texture pour orienter un brossage.
  const material = machined
    ? [
        lib.caseMetal(config, 'brushed', true),
        lib.caseMetal(config, 'satin', true),
        lib.caseMetal(config, 'polished', true),
      ]
    : lib.caseMetal(config, style.polished ? 'polished' : 'satin', true);
  const sides = style.integrated ? ([1] as const) : ([1, -1] as const);
  for (const sx of sides) {
    for (const sy of [1, -1] as const) {
      const geometry = hornGeometry({
        machined,
        aIn,
        aOut,
        // Rayon le plus petit du flanc galbé : le congé reste tangent ou noyé sur toute la
        // hauteur, sans rebord là où le flanc se resserre.
        flank: R - c * 0.6 - 0.05,
        surface,
        fillet: clamp(thickness * 0.7, 0.8, 1.8),
        yTip,
        tipRadius,
        ...(style.taper || style.taperInner
          ? {
              taper: {
                from: yJunction,
                amount: (style.taper ?? 0) * thickness,
                inner: (style.taperInner ?? 0) * thickness,
              },
            }
          : {}),
        sx,
        sy,
        yStart: R * 0.55,
        bevel,
        bevelSegments: style.bevelSegments,
        profile,
        root,
      });
      group.add(new THREE.Mesh(geometry, material));
    }
  }

  // Trous de barrette : petits puits sombres qui traversent chaque corne.
  if (style.drilled) {
    const radius = clamp(thickness * 0.2, 0.32, 0.5);
    const hole = new THREE.CylinderGeometry(radius, radius, thickness + 0.02, 24);
    hole.rotateZ(Math.PI / 2); // axe le long de x
    const dark = lib.matte('#0b0c0e');
    // Près de la pointe, à mi-hauteur du flanc de la corne.
    const y = yTip - tipRadius - Math.max(0.9, radius * 2.4);
    const { top, bottom } = profile(y);
    for (const sx of [1, -1]) {
      for (const sy of [1, -1]) {
        const mesh = new THREE.Mesh(hole, dark);
        mesh.position.set(sx * (aIn + thickness / 2), sy * y, bottom + (top - bottom) * 0.45);
        group.add(mesh);
      }
    }
  }
  return group;
}
