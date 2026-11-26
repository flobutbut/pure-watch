/** Rolled ends and their clear bores, in the strap's flat millimetre coordinates. */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { StrapBuilder } from './strap-geometry';

export interface StrapEye {
  s: number;
  z: number;
  radius: number;
  bore: number;
  reach: number;
  /** +1 at the case, -1 at the buckle: the flat return runs into the strap. */
  direction: 1 | -1;
}

export function caseStrapEye(type: string, s: number, z: number): StrapEye {
  return {
    s,
    z,
    radius: type === 'fabric' ? 1.1 : type === 'leather' ? 1.6 : 1.5,
    bore: 0.65,
    reach: 4.8,
    direction: 1,
  };
}

export function buckleStrapEye(type: string, length: number): StrapEye {
  return {
    s: length - 2.2,
    z: 1.05,
    radius: type === 'fabric' ? 1.1 : 1.5,
    bore: 0.66,
    reach: 4.6,
    direction: -1,
  };
}

/** Sweep a yz profile along x. The cyclic axis permutation preserves outside winding. */
function across(
  builder: StrapBuilder,
  shape: THREE.Shape,
  left: number,
  right: number,
  sign: number,
  material: THREE.Material,
  edge: THREE.Material,
  name: string,
  map: (x: number, u: number, z: number) => THREE.Vector3,
  steps = 16,
): void {
  const width = right - left,
    bevel = 0.07;
  const raw = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    steps,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 12,
  });
  for (const group of raw.groups) {
    let geometry: THREE.BufferGeometry = new THREE.BufferGeometry();
    for (const key of ['position', 'normal', 'uv']) {
      const attr = raw.attributes[key]!;
      geometry.setAttribute(
        key,
        new THREE.BufferAttribute(
          new Float32Array(
            attr.array.slice(
              group.start * attr.itemSize,
              (group.start + group.count) * attr.itemSize,
            ),
          ),
          attr.itemSize,
        ),
      );
    }
    const old = geometry;
    geometry = mergeVertices(old, 0.0001);
    old.dispose();
    const pos = geometry.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      const x = left + ((pos.getZ(i) + bevel) / (width + 2 * bevel)) * width;
      const point = map(x, pos.getX(i), pos.getY(i));
      pos.setXYZ(i, point.x, point.y, point.z);
    }
    builder.geometry(geometry, group.materialIndex === 0 ? edge : material, name, sign);
  }
  raw.dispose();
}

/** The nose is circular, the bore remains empty, and the return meets the band tangentially. */
export function rolledStrapEnd(
  builder: StrapBuilder,
  eye: StrapEye,
  width: (s: number) => number,
  top: (x: number, s: number) => number,
  material: THREE.Material,
  edge: THREE.Material,
  sign: number,
  name: string,
  notch = 0,
  bottom = 0,
): void {
  const join = eye.s + eye.direction * eye.reach;
  const shape = new THREE.Shape();
  const upper = top(0, join);
  shape.moveTo(eye.reach, upper);
  shape.bezierCurveTo(
    eye.reach * 0.62,
    upper,
    eye.reach * 0.34,
    eye.z + eye.radius,
    0,
    eye.z + eye.radius,
  );
  shape.absarc(0, eye.z, eye.radius, Math.PI / 2, Math.PI * 1.5, false);
  shape.bezierCurveTo(
    eye.reach * 0.35,
    eye.z - eye.radius,
    eye.reach * 0.64,
    bottom,
    eye.reach,
    bottom,
  );
  shape.closePath();
  const bore = new THREE.Path();
  bore.absarc(0, eye.z, eye.bore, 0, Math.PI * 2, true);
  shape.holes.push(bore);
  const half = width(eye.s) / 2;
  const spans =
    notch > 0
      ? [
          [-half, -notch / 2],
          [notch / 2, half],
        ]
      : [[-half, half]];
  for (const [left, right] of spans)
    across(builder, shape, left!, right!, sign, material, edge, name, (x, u, z) => {
      const s = eye.s + eye.direction * u;
      // The leather's padded centre fades into the roll; its axle bore stays circular.
      const t = THREE.MathUtils.smoothstep(u, eye.radius + 0.15, eye.reach);
      const fade = THREE.MathUtils.clamp((z - eye.z) / Math.max(0.5, upper - eye.z), 0, 1);
      const lift = (top(x, join) - upper) * t * fade;
      const taper = width(s) / width(eye.s);
      return new THREE.Vector3(eye.direction * x * taper, s, z + lift);
    });
}

/** Circular steel knuckle, open along the axle and independent of the bracelet bend. */
export function hingeSleeve(
  builder: StrapBuilder,
  x: number,
  width: number,
  s: number,
  z: number,
  radius: number,
  bore: number,
  material: THREE.Material,
  name: string,
): void {
  const shape = new THREE.Shape();
  shape.absarc(0, z, radius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, z, bore, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  across(
    builder,
    shape,
    x - width / 2,
    x + width / 2,
    1,
    material,
    material,
    name,
    (xx, u, zz) => new THREE.Vector3(xx, s + u, zz),
    1,
  );
}

/** Hollow metal sleeve at the tongue's pivot, separate from the axle it rotates around. */
export function tongueSleeve(
  builder: StrapBuilder,
  s: number,
  z: number,
  material: THREE.Material,
): void {
  hingeSleeve(builder, 0, 1, s, z, 0.78, 0.64, material, 'strap-tongue-hinge');
}
