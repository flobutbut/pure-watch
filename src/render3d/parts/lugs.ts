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
import { caseLevels } from './levels';
import { applyOcclusion } from './occlusion';
import { shapeRadius } from '../../core/geometry/case-shape';
import { caseConstruction } from '../../core/config/case-construction';
import { bezierGuide, domedGuide } from '../../core/geometry/case-guides';
import { caseDeckTop } from './levels';

export interface HornSpec {
  /** Optional continuous connection; absent for historical lugs and crown guards. */
  blendRadius?: number;
  aperture?: (theta: number) => number;
  shoulder?: (theta: number) => number;
  occlusionDepth?: number;
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

/** Smooth union of the shoulder and the lug's strip, with a bounded machining radius. */
function blendedSides(h: HornSpec): Sides {
  const surface = surfaceOf(h),
    radius = h.blendRadius!;
  // The inner fillet joins the side of this lug to the case locally. Taking the
  // inner edge of the whole case/strip union closes the strap gap, while clamping
  // that edge produces a sudden step when it leaves the top of the case.
  const localInner = h.aIn > 0 ? makeSide(h.aIn, -1, h) : undefined;
  const field = (x: number, y: number) => {
    const a = Math.hypot(x, y) - surface(Math.atan2(y, x));
    const b = Math.max(h.aIn - x, x - h.aOut);
    const t = clamp(0.5 + (0.5 * (b - a)) / radius, 0, 1);
    return b + (a - b) * t - radius * t * (1 - t);
  };
  const cache = new Map<number, { inner: number; outer: number }>();
  const at = (y: number) => {
    let found = cache.get(y);
    if (found) return found;
    const mid = (h.aIn + h.aOut) / 2;
    let lo = mid,
      hi = 200;
    for (let i = 0; i < 35; i++) {
      const x = (lo + hi) / 2;
      if (field(x, y) <= 0) lo = x;
      else hi = x;
    }
    const outer = lo;
    if (localInner) {
      found = { inner: localInner(y), outer };
      cache.set(y, found);
      return found;
    }
    lo = h.aIn < 0 ? -200 : 0;
    hi = mid;
    if (field(lo, y) > 0)
      for (let i = 0; i < 35; i++) {
        const x = (lo + hi) / 2;
        if (field(x, y) > 0) lo = x;
        else hi = x;
      }
    else hi = lo;
    found = { inner: hi, outer };
    cache.set(y, found);
    return found;
  };
  return { inner: (y) => at(y).inner, outer: (y) => at(y).outer };
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
  const sides: Sides = h.blendRadius
    ? blendedSides(h)
    : { inner: makeSide(h.aIn, -1, h), outer: makeSide(h.aOut, 1, h) };
  const rings = ys.map((y) => ring(y, h, segments, sides));

  const buckets = Array.from({ length: h.machined ? 3 : 1 }, () => ({
    positions: [] as number[],
    uvs: [] as number[],
  }));
  let materialIndex = 0;
  const push = (...vs: THREE.Vector3[]) => {
    for (const v of vs) {
      buckets[materialIndex]!.positions.push(v.x * h.sx, v.y * h.sy, v.z);
      // Coordonnées de texture simples pour le carbone forgé.
      buckets[materialIndex]!.uvs.push(v.x * 0.06, (v.y + v.z) * 0.06);
    }
  };
  // Les sections tournent dans le sens trigonométrique du plan (x, z), donc dans le sens
  // horaire vu depuis la pointe : on inverse les triangles pour orienter les faces vers
  // l'extérieur. Un quart miroir (sx·sy < 0) inverse déjà le sens.
  const flip = h.sx * h.sy > 0;
  const conformed = new WeakMap<THREE.Vector3, THREE.Vector3>();
  const apertureY = new Map<number, number>();
  const innerY = (x: number) => {
    const key = Math.round(x * 1e6);
    let start = apertureY.get(key);
    if (start === undefined) {
      start = surfaceY(x, h.aperture!);
      apertureY.set(key, start);
    }
    return start;
  };
  const conform = (v: THREE.Vector3) => {
    const cached = conformed.get(v);
    if (cached) return cached;
    const p = v.clone();
    if (h.aperture) {
      p.y = Math.max(p.y, innerY(p.x));
    }
    if (h.shoulder) {
      const r = Math.hypot(p.x, p.y),
        boundary = h.shoulder(Math.atan2(p.y, p.x));
      const t = clamp((boundary - r) / 0.2, 0, 1);
      // Buried overlap sits below the deck, avoiding two coincident top faces.
      const roof = h.root.top - 0.012 * t * t * (3 - 2 * t);
      p.z = Math.min(p.z, roof);
    }
    conformed.set(v, p);
    return p;
  };
  const ab = new THREE.Vector3(),
    ac = new THREE.Vector3();
  const emitTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    if (h.aperture || h.shoulder) {
      a = conform(a);
      b = conform(b);
      c = conform(c);
      if (ab.subVectors(b, a).cross(ac.subVectors(c, a)).lengthSq() < 1e-14) return;
    }
    if (flip) push(a, c, b);
    else push(a, b, c);
  };
  const clipX = (points: THREE.Vector3[], edge: number, sign: 1 | -1) => {
    const result: THREE.Vector3[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!,
        b = points[(i + 1) % points.length]!;
      const insideA = (a.x - edge) * sign >= 0,
        insideB = (b.x - edge) * sign >= 0;
      if (insideA) result.push(a);
      if (insideA !== insideB) {
        const p = a.clone().lerp(b, (edge - a.x) / (b.x - a.x));
        p.x = edge;
        result.push(p);
      }
    }
    return result;
  };
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    // Follow the inner curve across the whole face, not just its corners. Fixed
    // x-strips bound chord error without repeatedly subdividing the length of a lug.
    const minX = Math.min(a.x, b.x, c.x),
      maxX = Math.max(a.x, b.x, c.x),
      step = 0.4;
    if (h.aperture && maxX - minX > step) {
      for (let i = Math.floor(minX / step); i < Math.ceil(maxX / step); i++) {
        const polygon = clipX(clipX([a, b, c], i * step, 1), (i + 1) * step, -1);
        for (let j = 1; j < polygon.length - 1; j++)
          emitTriangle(polygon[0]!, polygon[j]!, polygon[j + 1]!);
      }
    } else emitTriangle(a, b, c);
  };
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
    return 1 - (h.occlusionDepth ?? 0.38) * nearRoot * Math.exp(-((Math.max(0, out) / 1.0) ** 2));
  });
  return smooth;
}

/* ---------- Styles de cornes (spec §5.1) ---------- */

export const LUG_STYLES = [
  'straight',
  'curved',
  'pointed',
  'faceted',
  'teardrop',
  'drilled',
  'integrated',
  'none',
];

/** Géométrie partagée des cornes : profil, pointe et raccord, pour les cornes et le bracelet. */
export function lugLayout(config: WatchConfig, d: WatchDimensions, refined: boolean) {
  // Both render modes now use the same attachment construction.
  void refined;
  const { R, T, c } = caseLevels(d);
  const construction = caseConstruction(config);
  const joined = construction.integration > 0,
    blended = construction.integration > 0;
  const machined = true;
  const style = {
    integrated: construction.attachment === 'block',
    drilled: construction.drilled,
    taper: construction.taper * 0.65,
    taperInner: 0,
    tipRadius: 0.08 + construction.tipRound * 0.37,
    bevelSegments: construction.edge === 'rounded' ? 6 : 1,
    polished: false,
  };
  const root = { top: caseDeckTop(d), bottom: d.z.back };
  const thickness = construction.lugWidthMm;
  // Boîtiers non ronds : la corne part de là où le flanc se trouve réellement.
  const shoulder = joined
    ? (theta: number) => R * shapeRadius(config.case.shape, theta) - 0.15
    : undefined;
  const surface = (theta: number) => R * shapeRadius(config.case.shape, theta) - 0.15;
  const yFlank = surfaceY(d.lugWidth / 2 + thickness, surface);
  const yTip = Math.max(d.lugToLug / 2, yFlank + R * 0.2);
  // Plan-view tapering and buried root splay do not depend on the longitudinal
  // profile's transition length. In particular, wide straps retain their neck.
  const roundFlank = surfaceY(d.lugWidth / 2 + thickness, () => R - c * 0.6 - 0.05);
  const taperStart = Math.min(R * 0.9 + yFlank - roundFlank, yTip - Math.max(1, R * 0.12));
  const centre = style.integrated ? 0 : Math.min(d.lugWidth / 2 + thickness * 0.5, R * 0.8);
  const landingY = surfaceY(centre, (theta) => R * shapeRadius(config.case.shape, theta) - c * 1.5);
  const profileStart = Math.min(
    Math.max(0, landingY - (0.5 + construction.transition * R * 0.14)),
    yTip - 1,
  );
  const tipOffset = construction.underside === 'flat' ? 0 : construction.tipOffsetMm;
  const tipTop = d.z.back + tipOffset + construction.tipThicknessMm;
  const span = yTip - profileStart;
  // The free end continues towards the wrist instead of returning to a
  // horizontal tangent. In the aligned mode only the upper taper descends.
  const bottomTipSlope =
    construction.underside === 'flat' ? 0 : clamp((tipOffset / span) * 1.35, -1.2, 0.8);
  const thinningSlope = -clamp(((root.top - tipTop) / span) * 0.35, 0, 0.8);
  const topTipSlope = Math.min(bottomTipSlope, thinningSlope);
  // The dome is the shape of the descent, not a small bump proportional to it:
  // taut (0) follows the eased guide, domed (1) holds the root height and rolls
  // over towards the tip. The drop itself comes from the tip thickness and height.
  const topGuide = domedGuide(
    bezierGuide(
      profileStart,
      yTip,
      { value: root.top, slope: 0, curvature: 0 },
      { value: tipTop, slope: topTipSlope, curvature: 0 },
    ),
    root.top,
    tipTop,
    construction.dome,
  );
  const bottomGuide = bezierGuide(
    profileStart,
    yTip,
    { value: d.z.back, slope: 0, curvature: 0 },
    { value: d.z.back + tipOffset, slope: bottomTipSlope, curvature: 0 },
  );
  const profile = (y: number) => ({
    top: topGuide.value(y),
    // A flat underside is a geometric constraint, independent of the top guide,
    // tip thinning, root recess, edge treatment and crown guards.
    bottom: construction.underside === 'flat' ? d.z.back : bottomGuide.value(y),
  });

  const aIn = style.integrated ? -(d.lugWidth / 2 + thickness) : d.lugWidth / 2;
  // L'arrondi d'arête ne doit jamais dépasser la moitié de la largeur ni le rayon de la
  // pointe : sinon le contour intérieur du biseau se retourne.
  const bevel = Math.min(
    construction.edge === 'sharp' ? 0.01 : construction.edgeSizeMm,
    thickness * (1 - construction.taper * 0.65) * 0.27,
  );
  const tipRadius = Math.max((style.tipRadius ?? 0.38) * thickness, bevel * 1.1);
  // Trou de barrette : près de la pointe, à mi-hauteur du flanc de la corne.
  const barRadius = clamp(thickness * 0.2, 0.32, 0.5);
  const barY = yTip - tipRadius - Math.max(0.9, barRadius * 2.4);
  const barZ = (y: number) => {
    const { top, bottom } = profile(y);
    return bottom + (top - bottom) * 0.45;
  };
  return {
    R,
    T,
    c,
    joined,
    blended,
    machined,
    style,
    root,
    thickness,
    shoulder,
    surface,
    yTip,
    taperStart,
    profileStart,
    profile,
    topGuide,
    bottomGuide,
    aIn,
    bevel,
    tipRadius,
    barRadius,
    barY,
    barZ,
  };
}

/**
 * Logement du bracelet d'un boîtier sans cornes : une poche creusée par-dessous à 12 h
 * et 6 h, où l'extrémité du bracelet se glisse sous la carrure. Le bord du boîtier reste
 * entier vu de face. `back` est la paroi du fond de la poche (y), `edge` le bord du
 * boîtier dans l'axe ; `height` est mesurée depuis le plan du fond. Null avec des attaches.
 */
export function strapPocket(config: WatchConfig, d: WatchDimensions) {
  if (caseConstruction(config).attachment !== 'none') return null;
  const { R } = caseLevels(d);
  const radius = (theta: number) => R * shapeRadius(config.case.shape, theta);
  const halfWidth = d.lugWidth / 2 + 0.2;
  const edge = radius(Math.PI / 2);
  // Round, octagonal and tonneau cases narrow towards 12 o'clock: the case edge above
  // the strap's corners is lower than in the axis. The strap end must stay covered
  // there too, so the pocket goes deeper than its usual depth on such shapes.
  const corner = surfaceY(halfWidth, radius);
  const COVER = 1.5;
  const usual = edge - clamp(R * 0.18, 2.5, 4.5);
  // Never into the central back, which the underside triangulates separately.
  const floor = 0.65 * edge + 0.8;
  const back = Math.max(floor, Math.min(usual, corner - COVER - 0.3));
  // Room for the thickest strap (padded leather, about 3.3 mm), while leaving the
  // flank above the pocket at least 40 % of the case body.
  const height = Math.min(3.6, (caseDeckTop(d) - d.z.back) * 0.6);
  return {
    halfWidth,
    back,
    edge,
    depth: edge - back,
    height,
    /** Where the strap end lies, clear of the back wall. */
    strapEnd: back + 0.3,
  };
}

/** Inclinaison maximale du départ du bracelet (rad) : au-delà, le brin devrait se redresser. */
const MAX_STRAP_TILT = 0.35;

/**
 * Logement de la barrette du bracelet : position (y, z) dans le plan de la corne et
 * inclinaison (rad, positive vers le poignet) de la ligne médiane de la corne à cet endroit.
 * `null` pour un boîtier sans corne.
 */
export function strapSeat(
  config: WatchConfig,
  d: WatchDimensions,
  refined = config.case.shape === 'cushion',
): { y: number; z: number; tilt: number } | null {
  if (config.case.lugs === 'none') return null;
  const lug = lugLayout(config, d, refined);
  const step = 0.4;
  const slope = (lug.barZ(lug.barY + step) - lug.barZ(lug.barY - step)) / (2 * step);
  return { y: lug.barY, z: lug.barZ(lug.barY), tilt: clamp(-Math.atan(slope), 0, MAX_STRAP_TILT) };
}

export function buildLugs(
  config: WatchConfig,
  d: WatchDimensions,
  lib: MaterialLibrary,
  refined = false,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'lugs';
  if (config.case.lugs === 'none') return group; // boîtier sans corne

  const {
    R,
    c,
    joined,
    blended,
    machined,
    style,
    root,
    thickness,
    shoulder,
    surface,
    yTip,
    profileStart,
    profile,
    aIn,
    bevel,
    tipRadius,
    barRadius,
    barY,
    barZ,
  } = lugLayout(config, d, refined);
  const aperture = joined
    ? (theta: number) =>
        Math.max(
          (d.openingRadius + 0.3) * d.dialScale * shapeRadius(d.dialShape, theta),
          shoulder!(theta) - 0.15,
        )
    : undefined;
  const aOut = d.lugWidth / 2 + thickness;

  // Satiné : la corne n'a pas de coordonnées de texture pour orienter un brossage.
  const material = machined
    ? [
        lib.caseMetal(config, 'brushed', true),
        lib.caseMetal(config, blended ? 'brushed' : 'satin', true),
        lib.caseMetal(config, 'polished', true),
      ]
    : lib.caseMetal(config, style.polished ? 'polished' : 'satin', true);
  const sides = style.integrated ? ([1] as const) : ([1, -1] as const);
  for (const sx of sides) {
    for (const sy of [1, -1] as const) {
      const geometry = hornGeometry({
        ...(joined ? { shoulder, aperture, occlusionDepth: blended ? 0 : 0.08 } : {}),
        ...(blended ? { blendRadius: clamp(thickness * 1.1, 1, 2.8) } : {}),
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
                from: profileStart,
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
    const hole = new THREE.CylinderGeometry(barRadius, barRadius, thickness + 0.02, 24);
    hole.rotateZ(Math.PI / 2); // axe le long de x
    const dark = lib.matte('#0b0c0e');
    for (const sx of [1, -1]) {
      for (const sy of [1, -1]) {
        const mesh = new THREE.Mesh(hole, dark);
        mesh.position.set(sx * (aIn + thickness / 2), sy * barY, barZ(barY));
        group.add(mesh);
      }
    }
  }
  return group;
}
