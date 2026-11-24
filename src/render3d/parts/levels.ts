/** Cotes intermédiaires du boîtier, partagées par toutes les pièces qui s'y raccordent. */
import * as THREE from 'three';
import { shapeRadius } from '../../core/geometry/case-shape';
import { clamp, type WatchDimensions } from '../../core/geometry/dimensions';

export function caseLevels(d: WatchDimensions) {
  const R = d.caseRadius;
  const T = d.caseThickness;
  const c = clamp(R * 0.034, 0.3, 0.65); // taille des chanfreins
  const flankTop = d.z.bezelTop - 0.2 * T * d.bezelHeight; // fixed shoulder; bezel can rise above it
  const seat = d.z.bezelTop - 0.012 * T - c; // appui du cristal sous la lunette
  return { R, T, c, flankTop, seat, rehautTop: Math.min(0.6, seat - 0.2) };
}

/** Flat shoulder below a separate bezel; independent of the bezel's added height. */
export function caseDeckTop(d: WatchDimensions): number {
  return caseLevels(d).seat - 0.2 * d.caseThickness * (d.bezelHeight - 1) - 0.12;
}

/**
 * Rayon (minimal) du flanc dans la direction θ, forme du boîtier comprise : c'est là que
 * cornes et ailettes se raccordent.
 */
export function flankRadiusAt(d: WatchDimensions, shape: string): (theta: number) => number {
  const { R, c } = caseLevels(d);
  const base = R - c * 0.6 - 0.05;
  return (theta) => base + (shapeRadius(shape, theta) - 1) * R;
}

/** Rayon extérieur du boîtier dans la direction θ (au plus large du flanc). */
export function outerRadiusAt(d: WatchDimensions, shape: string, theta: number): number {
  return d.caseRadius * shapeRadius(shape, theta);
}

/**
 * Déforme une pièce tournée vers la forme du boîtier : les surfaces extérieures épousent
 * la forme. Le devant rejoint le contour indépendant du cadran ; les flancs, le fond
 * et les raccords des cornes gardent leur silhouette, indépendamment de l’ouverture.
 */
export function shapeLathe(
  geometry: THREE.BufferGeometry,
  d: WatchDimensions,
  shape: string,
  linearFront = false,
  profiledBody = false,
): void {
  if (shape === 'round' && d.dialShape === 'round') return;
  const R = d.caseRadius;
  const inner = d.openingRadius;
  const bodyInner = R - clamp(R * 2 * 0.065, 1.4, 3.2);
  const pos = geometry.getAttribute('position');
  const { c, flankTop, rehautTop } = caseLevels(d);
  // New midcase sections use a constant contour offset across their full radial depth.
  // The inset caseback still eases into that contour, without folding the side profile.
  const bodyOuter = profiledBody ? R - c * 2.2 : R;
  const contours = new Map<number, { caseRadius: number; opening: number }>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.hypot(x, y);
    if (r < 1e-6) continue;
    const t = clamp((r - inner) / (R - inner), 0, 1);
    const bodyT = clamp((r - bodyInner) / (bodyOuter - bodyInner), 0, 1);
    const w = bodyT * bodyT * (3 - 2 * bodyT);
    const theta = Math.atan2(y, x);
    const caseFactor = shapeRadius(shape, theta);
    let outer = R * caseFactor;
    let radius = r + (caseFactor - 1) * R * w;
    if (d.dialShape !== 'round' || linearFront || Math.abs(inner - bodyInner) > 1e-6) {
      const key = Math.round(theta * 1e5);
      let contour = contours.get(key);
      if (!contour) {
        contour = {
          caseRadius: outer,
          opening: inner * d.dialScale * shapeRadius(d.dialShape, theta),
        };
        contours.set(key, contour);
      }
      outer = contour.caseRadius;
      const opening = contour.opening;
      const front = r <= inner ? (r / inner) * opening : opening + t * (outer - opening);
      const height = clamp((pos.getZ(i) - flankTop) / (c * 0.9), 0, 1);
      const nearOpening = 1 - clamp((r - inner) / (c * 1.2), 0, 1);
      const influence = pos.getZ(i) >= rehautTop - 1e-6 ? Math.max(height, nearOpening) : height;
      radius += (front - radius) * influence;
    }
    const k = radius / r;
    pos.setXY(i, x * k, y * k);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

/**
 * Coordonnées de texture métriques pour une pièce tournée : u suit le tour (en mm), v la
 * hauteur et le rayon. Les textures (carbone, patine) gardent leurs proportions et le
 * brossage reste circulaire (u croît toujours dans le sens du tour).
 */
export function metricLatheUV(geometry: THREE.BufferGeometry, radius: number): void {
  const pos = geometry.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const theta = Math.atan2(y, x);
    uv[i * 2] = (theta * radius) / 12;
    uv[i * 2 + 1] = (z + Math.hypot(x, y)) / 12;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** Apply the common aperture contour to a dial, rehaut, crystal or gasket. */
export function shapeAperture(geometry: THREE.BufferGeometry, d: WatchDimensions): void {
  if (d.dialShape === 'round') return;
  const pos = geometry.getAttribute('position');
  const factors = new Map<number, number>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const angle = Math.atan2(y, x);
    const key = Math.round(angle * 1e5);
    let k = factors.get(key);
    if (k === undefined) {
      k = d.dialScale * shapeRadius(d.dialShape, angle);
      factors.set(key, k);
    }
    pos.setXY(i, x * k, y * k);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}
