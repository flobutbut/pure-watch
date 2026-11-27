/** Detailed straps in flat millimetre coordinates, swept around the presentation arc. */
import * as THREE from 'three';
import type { WatchConfig } from '../../core/config/types';
import { strapSettings, STRAP_LENGTHS } from '../../core/config/strap';
import type { WatchDimensions } from '../../core/geometry/dimensions';
import { shapeRadius } from '../../core/geometry/case-shape';
import type { MaterialLibrary } from '../materials';
import { StrapBuilder, roundedRect, roundHole } from './strap-geometry';
import { strapHardware, strapSpringBar } from './strap-hardware';
import {
  METAL_FIRST_LINK,
  metalBandEnd,
  metalRootHinge,
  metalTerminalAttachment,
  meshRootAttachment,
} from './strap-metal';
import { strapPocket, strapSeat } from './lugs';
import { caseStrapEye, buckleStrapEye, rolledStrapEnd } from './strap-attachments';

const V = (x: number, s: number, z: number) => new THREE.Vector3(x, s, z);
const ease = (value: number) => {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Strap templates per material library and scope. The live watch has a cache of its
 * own: the thumbnails of a grid row build a dozen other straps, which would otherwise
 * evict it and cost the live preview a 200 ms rebuild at every slider step. A strap
 * weighs 2 to 3.4 MB, hence small limits.
 */
export type StrapCacheScope = 'live' | 'shared';
const LIMITS: Record<StrapCacheScope, number> = { live: 2, shared: 6 };
const templates = new WeakMap<MaterialLibrary, Record<StrapCacheScope, Map<string, THREE.Group>>>();
function cloneStrap(template: THREE.Group): THREE.Group {
  const root = template.clone(true);
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry = object.geometry.clone();
  });
  return root;
}
function disposeTemplate(root: THREE.Group): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
  });
}

/** Position de la barrette dans le repère du brin : avance (s) et hauteur (z), en mm. */
const BAR_S = 0.6,
  BAR_Z = 1.25;
/** Longueur (mm) sur laquelle l'écart de hauteur du départ incliné se résorbe. */
const TILT_FADE = 30;

export function buildStrap(
  config: WatchConfig,
  d: WatchDimensions,
  lib: MaterialLibrary,
  refined = config.case.shape === 'cushion',
  scope: StrapCacheScope = 'shared',
): THREE.Group {
  const strap = strapSettings(config),
    metal = strap.type === 'metal',
    leather = strap.type === 'leather',
    cloth = strap.type === 'fabric';
  // La barrette (s = BAR_S, z = BAR_Z dans le repère du brin) se loge dans la corne ; le brin
  // part dans l'inclinaison de la corne puis rejoint la présentation courbée.
  const caseEdge = d.caseRadius * shapeRadius(config.case.shape, Math.PI / 2);
  const baseThickness = metal
    ? strap.material === 'mesh'
      ? 1.5
      : 2.8
    : cloth
      ? 1.25
      : leather
        ? 2.45
        : 2.65;
  // Sans cornes, l'extrémité se glisse dans la poche creusée sous la carrure : le dessous
  // affleure le fond, et descend un peu si le bracelet est plus épais que la poche.
  const pocket = strapPocket(config, d);
  const seat = pocket ? null : strapSeat(config, d, refined);
  const tilt = seat?.tilt ?? 0,
    ty = Math.cos(tilt),
    tz = -Math.sin(tilt);
  const thickest = baseThickness + (leather ? 0.8 : 0);
  // In a pocket the strap ends as a plain band: a rolled loop and its spring bar are
  // some 5 mm long and would show beyond the case edge on narrowing shapes.
  const caseEye = !metal && !pocket ? caseStrapEye(strap.type, BAR_S, BAR_Z) : null;
  const anchor = pocket
    ? pocket.strapEnd
    : seat
      ? Math.max(caseEdge - 1.2, seat.y - BAR_S * ty + BAR_Z * tz)
      : caseEdge - 0.8;
  const baseZ = pocket
    ? d.z.back + Math.min(0.1, pocket.height - 0.15 - thickest)
    : seat
      ? seat.z - BAR_S * tz - BAR_Z * ty
      : d.z.back + d.caseThickness * 0.28;
  const key = JSON.stringify([
    strap,
    config.case.shape,
    config.case.lugs,
    config.case.material,
    config.case.finish,
    d.caseRadius,
    d.lugWidth,
    anchor,
    baseZ,
    tilt,
  ]);
  const caches = templates.get(lib) ?? { live: new Map(), shared: new Map() };
  templates.set(lib, caches);
  const cache = caches[scope];
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    return cloneStrap(cached);
  }
  // Ligne médiane du brin : un départ droit dans l'axe de la corne, jusqu'au point où
  // l'ellipse de présentation prend la même pente (tangentes continues, la courbure ne
  // change jamais de sens), puis l'ellipse ; l'écart de hauteur se résorbe sur TILT_FADE mm.
  const ellipse = (s: number) => {
    const a = s / 38;
    return { y: anchor * Math.cos(a) + 32 * Math.sin(a), z: baseZ - 31 * (1 - Math.cos(a)) };
  };
  let s0 = 0;
  if (tilt > 0) {
    let hi = 19 * Math.PI;
    for (let i = 0; i < 28; i++) {
      const mid = (s0 + hi) / 2,
        a = mid / 38;
      if (Math.atan2(31 * Math.sin(a), 32 * Math.cos(a) - anchor * Math.sin(a)) < tilt) s0 = mid;
      else hi = mid;
    }
  }
  const e0 = ellipse(s0);
  const speed = s0 > 0 ? (e0.y - anchor) / (s0 * ty) : 1,
    drop = baseZ + s0 * speed * tz - e0.z;
  const centre = (s: number) => {
    if (s < s0) return { y: anchor + s * speed * ty, z: baseZ + s * speed * tz };
    const e = ellipse(s);
    return { y: e.y, z: e.z + drop * (1 - ease((s - s0) / TILT_FADE)) };
  };
  const builder = new StrapBuilder((x, s, z, sign) => {
    const p = centre(s),
      q = centre(s + 0.05),
      o = centre(s - 0.05),
      dy = q.y - o.y,
      dz = q.z - o.z,
      norm = Math.hypot(dy, dz);
    return V(x * sign, sign * (p.y - (z * dz) / norm), p.z + (z * dy) / norm);
  });
  const face = lib.strap(strap),
    edge = lib.strap(strap, false, 'edge'),
    lining = lib.strap(strap, false, 'lining');
  const polished = lib.strap(strap, true),
    shadow = lib.matte(new THREE.Color(strap.color).multiplyScalar(0.34).getStyle());
  const lengths = STRAP_LENGTHS[strap.length ?? 'standard'];
  const widthAt = (s: number) => d.lugWidth - 0.3 - (strap.taperMm ?? 4) * ease((s - 3) / 45);
  const top = (x: number, s: number) => {
    const padding = leather
      ? 0.8 *
        (1 - ease((s - 18) / 55)) *
        Math.pow(Math.max(0, 1 - ((2 * x) / widthAt(s)) ** 2), 1.5)
      : 0;
    return (
      baseThickness -
      (leather || strap.type === 'rubber' ? 0.45 * ease((s - 45) / 55) : 0) +
      padding
    );
  };

  const buckleEye = !metal ? buckleStrapEye(strap.type, lengths[0]) : null;
  const bodyStart = caseEye ? caseEye.s + caseEye.reach : 0;

  function bandOutline(begin: number, end: number, pointed: boolean): THREE.Shape {
    const shape = new THREE.Shape();
    const tip = pointed ? Math.min(5, widthAt(end) * 0.34) : 0;
    shape.moveTo(-widthAt(begin) / 2, begin);
    shape.lineTo(widthAt(begin) / 2, begin);
    for (let s = begin + 2; s < Math.min(50, end - tip); s += 2) shape.lineTo(widthAt(s) / 2, s);
    const w = widthAt(end) / 2;
    shape.lineTo(w, end - tip);
    if (pointed) {
      shape.quadraticCurveTo(w, end, 0, end);
      shape.quadraticCurveTo(-w, end, -w, end - tip);
    } else shape.lineTo(-w, end);
    for (let s = Math.min(50, end - tip); s > begin; s -= 2) shape.lineTo(-widthAt(s) / 2, s);
    shape.closePath();
    return shape;
  }

  for (const [half, length] of lengths.entries()) {
    const sign = half === 0 ? 1 : -1;
    // Cornes intégrées : le brin vient contre le bloc, l'attache reste cachée.
    if (config.case.lugs !== 'integrated' && !pocket)
      strapSpringBar(builder, lib, config, d.lugWidth - 0.2, sign, BAR_S, BAR_Z);
    if (caseEye)
      rolledStrapEnd(
        builder,
        caseEye,
        widthAt,
        top,
        face,
        edge,
        sign,
        'strap-root-eye',
        0,
        leather ? -0.36 : 0,
      );
    const bodyEnd = metal
      ? metalBandEnd(strap, length)
      : half === 0 && buckleEye
        ? buckleEye.s - buckleEye.reach
        : length;
    if (metal)
      metalTerminalAttachment(builder, strap, length, widthAt(bodyEnd), sign, face, polished);
    const pointed = half === 1 || metal;
    if (metal && strap.material !== 'mesh') {
      const five = strap.material === 'five-link',
        pitch = five ? 4.3 : 6.2;
      const fractions = five ? [0.22, 0.16, 0.24, 0.16, 0.22] : [0.3, 0.4, 0.3];
      const centreFraction = five ? 0.24 : 0.4;
      metalRootHinge(builder, widthAt(3.7), centreFraction, sign, face, polished);
      // A fitted solid end link follows the case outline instead of leaving a square gap.
      const endLink = new THREE.Shape(),
        halfWidth = widthAt(0) / 2;
      const surfaceY = (x: number) => {
        let lo = 0,
          hi = d.caseRadius * 1.5;
        for (let i = 0; i < 28; i++) {
          const y = (lo + hi) / 2;
          if (Math.hypot(x, y) < d.caseRadius * shapeRadius(config.case.shape, Math.atan2(y, x)))
            lo = y;
          else hi = y;
        }
        return lo;
      };
      for (let i = 0; i <= 16; i++) {
        const x = -halfWidth + (2 * halfWidth * i) / 16;
        // In a pocket the end link starts square at the anchor, hidden under the case.
        if (pocket) {
          if (i === 0) endLink.moveTo(-halfWidth, 0);
          else if (i === 16) endLink.lineTo(halfWidth, 0);
          continue;
        }
        const contact = surfaceY(x) - 0.35;
        let lo = -16,
          hi = 0;
        for (let j = 0; j < 24; j++) {
          const s = (lo + hi) / 2,
            y = centre(s).y;
          if (y < contact) lo = s;
          else hi = s;
        }
        if (i === 0) endLink.moveTo(x, lo);
        else endLink.lineTo(x, lo);
      }
      const tongue = halfWidth * centreFraction;
      endLink.lineTo(halfWidth, 2.3);
      endLink.lineTo(tongue, 2.3);
      endLink.lineTo(tongue, 2.9);
      endLink.lineTo(-tongue, 2.9);
      endLink.lineTo(-tongue, 2.3);
      endLink.lineTo(-halfWidth, 2.3);
      endLink.closePath();
      builder.extrude(endLink, 2.6, sign, face, 'strap-end-link', 0, 0.2, {
        edge: polished,
        detail: 1.8,
        lift: (x, _s, z) => z + Math.max(0, z / 2.6) * Math.max(0, 1 - (x / halfWidth) ** 2) * 0.2,
      });
      for (let s = METAL_FIRST_LINK; s < bodyEnd - 0.4; s += pitch) {
        const w = widthAt(s);
        let left = -w / 2;
        for (const [col, fraction] of fractions.entries()) {
          const center = col > 0 && col < fractions.length - 1;
          const width = w * fraction - 0.25,
            x = left + (w * fraction) / 2;
          const first = s === METAL_FIRST_LINK;
          const stagger = first
            ? col === Math.floor(fractions.length / 2)
              ? 0.35
              : 0
            : five && col % 2 === 1
              ? pitch * 0.23
              : center
                ? 0.35
                : 0;
          const start = s + stagger,
            linkLength = Math.min(pitch - 0.4, bodyEnd - start);
          left += w * fraction;
          if (linkLength < 0.6) continue;
          const shape = roundedRect(x, start, width, linkLength, five ? 0.65 : 0.7);
          builder.extrude(
            shape,
            baseThickness,
            sign,
            center && five ? polished : face,
            'strap-link',
            0,
            0.22,
            {
              edge: polished,
              detail: 3.5,
              lift: (xx, ss, z) =>
                z +
                Math.max(0, z / baseThickness) *
                  (Math.max(0, 1 - ((xx - x) / (width / 2)) ** 2) * 0.12 +
                    Math.sin(Math.PI * THREE.MathUtils.clamp((ss - start) / linkLength, 0, 1)) *
                      0.12),
            },
          );
        }
        builder.pin(0, s + 0.7, 0.65, w - 0.4, 0.48, sign, edge, 'strap-link-axle');
        if (Math.floor(s / pitch) % 2 === 0)
          for (const side of [-1, 1]) {
            builder.pin(
              side * (w / 2 + 0.03),
              s + pitch * 0.55,
              1.4,
              0.16,
              0.6,
              sign,
              polished,
              'strap-link-screw',
            );
            builder.box(
              side * (w / 2 + 0.12),
              s + pitch * 0.55,
              1.4,
              0.035,
              0.75,
              0.12,
              sign,
              shadow,
              'strap-screw-slot',
            );
          }
      }
    } else {
      const shape = bandOutline(bodyStart, bodyEnd, pointed);
      const adjustmentStart = length - 48;
      if (strap.material === 'rally') {
        const end = half === 1 ? adjustmentStart - 5 : length - 28;
        for (let s = 12; s < end; s += 8.5) {
          const radius = Math.min(leather ? 2.2 : 1.7, widthAt(s) * 0.14);
          roundHole(shape, 0, s, radius);
          if (!leather)
            for (const side of [-1, 1])
              roundHole(shape, side * widthAt(s) * 0.29, s, Math.min(1, widthAt(s) * 0.065));
        }
      }
      const adjustmentHoles: number[] = [];
      if (half === 1 && !metal)
        for (let s = adjustmentStart; s < length - 8; s += 7) {
          roundHole(shape, 0, s, 0.85);
          adjustmentHoles.push(s);
        }
      if (!metal)
        builder.extrude(shape, baseThickness, sign, face, 'strap-band', 0, 0.18, {
          edge,
          detail: 2.5,
          lift: (x, s, z) => (z / baseThickness) * top(x, s),
        });
      if (leather) {
        builder.extrude(shape, 0.35, sign, lining, 'strap-lining', -0.36, 0.12, { detail: 2.5 });
        // A pressed seam channel, followed by individual arched stitches made of two strands.
        for (const side of [-1, 1]) {
          const seam: THREE.Vector3[] = [];
          for (let s = bodyStart + 0.6; s < bodyEnd - (pointed ? 6 : 0.8); s += 1.5) {
            const x = side * (widthAt(s) / 2 - 1);
            seam.push(V(x, s, top(x, s) + 0.03));
          }
          if (strap.stitching) {
            builder.tube(seam, 0.075, sign, edge, 'strap-seam-channel', 5);
            const thread = lib.matte(strap.stitching);
            for (let s = bodyStart + 1; s < bodyEnd - (pointed ? 7 : 1.5); s += 2.2)
              for (const twist of [-1, 1]) {
                const pts: THREE.Vector3[] = [];
                for (let i = 0; i <= 5; i++) {
                  const t = i / 5,
                    at = s + t * 1.35,
                    x =
                      side * (widthAt(at) / 2 - 1) +
                      (t - 0.5) * 0.16 +
                      twist * 0.035 * Math.cos(t * Math.PI * 3);
                  pts.push(
                    V(
                      x,
                      at,
                      top(x, at) +
                        0.13 +
                        Math.sin(t * Math.PI) * 0.055 +
                        twist * 0.035 * Math.sin(t * Math.PI * 3),
                    ),
                  );
                }
                builder.tube(pts, 0.046, sign, thread, 'strap-stitch', 5);
              }
          }
        }
      }
      if (strap.type === 'rubber') {
        // A broad molded centre with a fine border; ribs are separated by recessed channels.
        const end = half === 1 ? adjustmentStart - 3 : length - 29;
        if (strap.material === 'ribbed')
          for (let s = 7; s < end; s += 3.6) {
            builder.extrude(
              roundedRect(0, s, widthAt(s) - 2.1, 2.85, 0.5),
              0.36,
              sign,
              face,
              'strap-rib',
              top(0, s) - 0.08,
              0.16,
              { detail: 2 },
            );
          }
        for (const side of [-1, 1]) {
          const pts: THREE.Vector3[] = [];
          for (let s = bodyStart + 0.5; s < bodyEnd - (pointed ? 6 : 0.8); s += 1.5) {
            const x = side * (widthAt(s) / 2 - 0.7);
            pts.push(V(x, s, top(x, s) + 0.05));
          }
          builder.tube(pts, 0.12, sign, face, 'strap-molded-border', 6);
        }
        // Discreet cooling ribs beneath the strap, visible from the back and profile views.
        for (let s = 9; s < Math.min(59, length - 25); s += 4.5)
          builder.extrude(
            roundedRect(0, s, widthAt(s) - 3, 1.8, 0.4),
            0.18,
            sign,
            lining,
            'strap-ventilation',
            -0.25,
            0.08,
          );
      }
      if (metal) {
        meshRootAttachment(builder, widthAt(0), BAR_S, BAR_Z, sign, face, polished);
        // Interlaced herringbone wires: both faces stay open, without a flat backing sheet.
        for (let s = 3.5; s < bodyEnd - 0.2; s += 0.95)
          for (const slope of [-1, 1]) {
            const points: THREE.Vector3[] = [],
              w = widthAt(s) - 0.7;
            for (let i = 0; i <= 24; i++) {
              const x = -w / 2 + (w * i) / 24,
                phase = x / 1.45;
              points.push(
                V(
                  x,
                  s + slope * Math.abs(Math.sin(phase * Math.PI)) * 0.28,
                  0.9 + 0.32 * Math.cos(phase * Math.PI * 2 + (slope * Math.PI) / 2),
                ),
              );
            }
            builder.tube(
              points,
              0.185,
              sign,
              slope === 1 ? polished : face,
              'strap-mesh-wire',
              5,
              1.3,
            );
          }
        for (const side of [-1, 1]) {
          const pts: THREE.Vector3[] = [];
          for (let s = 3.5; s < bodyEnd - 0.2; s += 2)
            pts.push(V(side * (widthAt(s) / 2 - 0.1), s, baseThickness * 0.75));
          builder.tube(pts, 0.24, sign, polished, 'strap-mesh-selvedge', 7);
        }
      }
      if (cloth) {
        const stripeMaterial = lib.strap({ ...strap, color: '#D5CBB2' });
        const light = lib.strap({
          ...strap,
          color: new THREE.Color(strap.color)
            .offsetHSL(0, -0.02, 0.06)
            .getHexString()
            .replace(/^/, '#') as `#${string}`,
        });
        // Dense woven normals carry the fine fibres; a few physical yarns catch grazing light.
        const yarnPitch = strap.material === 'ribbed' ? 1.3 : 1.2;
        for (let s = bodyStart + 0.5; s < bodyEnd - (pointed ? 5 : 0.5); s += yarnPitch) {
          const w = widthAt(s) - 1;
          // The weave stops at each punched adjustment hole rather than bridging it.
          const nearHole = adjustmentHoles.some((at) => Math.abs(at - s) < 1.05);
          const spans = nearHole
            ? [
                [-w / 2, -1.05],
                [1.05, w / 2],
              ]
            : [[-w / 2, w / 2]];
          for (const [from, to] of spans) {
            const pts: THREE.Vector3[] = [];
            for (let i = 0; i <= 16; i++) {
              const x = from! + ((to! - from!) * i) / 16;
              pts.push(V(x, s, baseThickness + 0.06 + 0.025 * Math.cos(i * Math.PI)));
            }
            builder.tube(
              pts,
              strap.material === 'ribbed' ? 0.09 : 0.055,
              sign,
              Math.round(s / yarnPitch) % 2 ? light : face,
              'strap-woven-yarn',
              4,
            );
          }
        }
        if (strap.material === 'striped')
          for (const side of [-1, 1]) {
            // Short quad strips follow the bend exactly; long extruded cap triangles can
            // sink under the strap between their endpoints and hide the dyed stripes.
            const positions: number[] = [],
              indices: number[] = [];
            const end = bodyEnd - (pointed ? 5 : 0);
            const rows = Math.ceil((end - bodyStart) / 1.25);
            for (let i = 0; i <= rows; i++) {
              const s = bodyStart + ((end - bodyStart) * i) / rows,
                x = side * widthAt(s) * 0.18;
              positions.push(
                x - 0.65,
                s,
                baseThickness + 0.105,
                x + 0.65,
                s,
                baseThickness + 0.105,
              );
              if (i < rows) {
                const a = i * 2;
                indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
              }
            }
            const ribbon = new THREE.BufferGeometry();
            ribbon.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            ribbon.setIndex(indices);
            builder.geometry(ribbon, stripeMaterial, 'strap-stripe', sign);
          }
        for (const side of [-1, 1]) {
          const pts: THREE.Vector3[] = [];
          for (let s = bodyStart + 0.5; s < bodyEnd - (pointed ? 5 : 0.5); s += 1.5)
            pts.push(V(side * (widthAt(s) / 2 - 0.25), s, baseThickness - 0.05));
          builder.tube(pts, 0.16, sign, edge, 'strap-bound-edge', 6);
        }
        // Folded reinforcement near the spring bar and the buckle, sewn across the weave.
        for (const at of [bodyStart + 1, half === 0 ? bodyEnd - 1.8 : length - 7]) {
          builder.extrude(
            roundedRect(0, at, widthAt(at) - 0.7, 1.1, 0.3),
            0.12,
            sign,
            face,
            'strap-reinforcement',
            baseThickness + 0.04,
            0.08,
          );
          for (let x = -widthAt(at) / 2 + 1.2; x < widthAt(at) / 2 - 1; x += 1.1)
            builder.tube(
              [V(x, at + 0.2, baseThickness + 0.26), V(x + 0.6, at + 0.55, baseThickness + 0.27)],
              0.045,
              sign,
              light,
              'strap-fabric-stitch',
              4,
            );
        }
      }
    }
  }
  strapHardware(builder, config, strap, lib, lengths[0], widthAt, top);
  const model = builder.finish();
  cache.set(key, model);
  while (cache.size > LIMITS[scope]) {
    const oldest = cache.keys().next().value!;
    disposeTemplate(cache.get(oldest)!);
    cache.delete(oldest);
  }
  return cloneStrap(model);
}
