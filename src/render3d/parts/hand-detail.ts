/** Hand-specific finishing. Dial indices retain their original geometry. */
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { normalize, type Sample } from './profile';

/** Continuous plate with real cut-outs. The edge break stays within the hand's Z envelope. */
export function piercedProfile(
  samples: readonly Sample[],
  holes: readonly (readonly Sample[])[],
  thickness: number,
): THREE.BufferGeometry {
  const width = Math.max(...samples.map(([, w]) => w));
  const bevel = Math.min(0.025, width * 0.025, thickness * 0.2);
  const outline = new THREE.Shape();
  const points = samples.map(
    ([y, w], i) =>
      [
        y + (i === 0 ? bevel : i === samples.length - 1 ? -bevel : 0),
        Math.max(0, w - bevel),
      ] as const,
  );
  outline.moveTo(-points[0]![1], points[0]![0]);
  for (const [y, w] of points.slice(1)) outline.lineTo(-w, y);
  for (const [y, w] of [...points].reverse()) outline.lineTo(w, y);
  outline.closePath();
  for (const hole of holes) {
    const path = new THREE.Path();
    path.moveTo(-hole[0]![1], hole[0]![0]);
    for (const [y, w] of hole.slice(1)) path.lineTo(-w, y);
    for (const [y, w] of [...hole].reverse()) path.lineTo(w, y);
    path.closePath();
    outline.holes.push(path);
  }
  const raw = new THREE.ExtrudeGeometry(outline, {
    depth: thickness - 2 * bevel,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 1,
    steps: 1,
    curveSegments: 12,
  });
  raw.translate(0, 0, bevel);
  return toCreasedNormals(normalize(raw), THREE.MathUtils.degToRad(22));
}

/** Preserve the existing ridge and outer contour; inset only the upper edge. */
export function beveledProfile(
  samples: readonly Sample[],
  thickness: number,
  ridge: number,
  smooth = false,
): THREE.BufferGeometry {
  const maxW = Math.max(...samples.map(([, w]) => w));
  const buckets: number[][] = [[], []];
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();
  const tri = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    direction: THREE.Vector3,
    material: number,
  ) => {
    n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
    if (n.lengthSq() < 1e-14) return;
    const vertices = n.dot(direction) >= 0 ? [a, b, c] : [a, c, b];
    for (const v of vertices) buckets[material]!.push(v.x, v.y, v.z);
  };
  const quad = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: THREE.Vector3,
    normal: THREE.Vector3,
    material: number,
  ) => {
    tri(a, b, c, normal, material);
    tri(a, c, d, normal, material);
  };
  const up = new THREE.Vector3(0, 0, 1);
  const down = new THREE.Vector3(0, 0, -1);
  const left = new THREE.Vector3(-1, 0, 0);
  const right = new THREE.Vector3(1, 0, 0);
  const sections = samples.map(([y, w], i) => {
    const bevel = Math.min(0.045, w * 0.22, thickness * 0.28);
    const endShift = i === 0 ? bevel : i === samples.length - 1 ? -bevel : 0;
    const topZ = thickness + (ridge * bevel) / maxW;
    return {
      lb: new THREE.Vector3(-w, y, 0),
      rb: new THREE.Vector3(w, y, 0),
      lu: new THREE.Vector3(-w, y, thickness - bevel),
      ru: new THREE.Vector3(w, y, thickness - bevel),
      lt: new THREE.Vector3(-Math.max(0, w - bevel), y + endShift, topZ),
      rt: new THREE.Vector3(Math.max(0, w - bevel), y + endShift, topZ),
      ct: new THREE.Vector3(0, y + endShift, thickness + (ridge * w) / maxW),
    };
  });
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i]!;
    const b = sections[i + 1]!;
    quad(a.lt, b.lt, b.ct, a.ct, up, 0);
    quad(a.ct, b.ct, b.rt, a.rt, up, 0);
    quad(a.lb, a.rb, b.rb, b.lb, down, 0);
    quad(a.lu, b.lu, b.lt, a.lt, left, 1);
    quad(a.rt, b.rt, b.ru, a.ru, right, 1);
    quad(a.lb, b.lb, b.lu, a.lu, left, 1);
    quad(a.ru, b.ru, b.rb, a.rb, right, 1);
  }
  for (const [i, sign] of [
    [0, -1],
    [sections.length - 1, 1],
  ] as const) {
    const end = sections[i]!;
    const direction = new THREE.Vector3(0, sign, 0);
    quad(end.lb, end.rb, end.ru, end.lu, direction, 1);
    quad(end.lu, end.ru, end.rt, end.lt, direction, 1);
    tri(end.lt, end.rt, end.ct, direction, 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(buckets.flat(), 3));
  geometry.addGroup(0, buckets[0]!.length / 3, 0);
  geometry.addGroup(buckets[0]!.length / 3, buckets[1]!.length / 3, 1);
  geometry.computeVertexNormals();
  // Smooth the leaf longitudinally, while preserving its ridge and the 45° edge.
  return smooth ? toCreasedNormals(geometry, THREE.MathUtils.degToRad(10)) : geometry;
}

/** One continuous pierced plate, replacing three overlapping Breguet components. */
export function piercedBreguet(
  length: number,
  k: number,
  slimness: number,
  thickness: number,
): THREE.BufferGeometry {
  const scale = k * slimness;
  const bevel = Math.min(0.035, scale * 0.055, thickness * 0.24);
  const ringY = length * 0.72;
  const outer = 1.25 * scale - bevel;
  const inner = 0.82 * scale + bevel;
  const rootW = 0.32 * scale - bevel;
  const pivotW = 0.4 * scale - bevel;
  const stemW = 0.26 * scale - bevel;
  const tail = 2 * k - bevel;
  const tip = length - bevel;
  const lowerEnd = ringY - outer + 0.1 * k;
  const upperStart = ringY + outer - 0.1 * k;
  const stemWidth = (y: number) => pivotW + ((stemW - pivotW) * y) / lowerEnd;
  const tipWidth = (y: number) => ((0.3 * scale - bevel) * (tip - y)) / (tip - upperStart);
  const join = (lo: number, hi: number, width: (y: number) => number, lower: boolean) => {
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const outside = width(mid) ** 2 + (mid - ringY) ** 2 > outer ** 2;
      if (outside === lower) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const lower = join(ringY - outer, lowerEnd, stemWidth, true);
  const upper = join(upperStart, ringY + outer, tipWidth, false);
  const bottomW = stemWidth(lower);
  const topW = tipWidth(upper);
  const shape = new THREE.Shape();
  shape.moveTo(-rootW, -tail);
  shape.lineTo(-pivotW, 0);
  shape.lineTo(-bottomW, lower);
  shape.absarc(
    0,
    ringY,
    outer,
    Math.atan2(lower - ringY, -bottomW),
    Math.atan2(upper - ringY, -topW),
    true,
  );
  shape.lineTo(0, tip);
  shape.lineTo(topW, upper);
  shape.absarc(
    0,
    ringY,
    outer,
    Math.atan2(upper - ringY, topW),
    Math.atan2(lower - ringY, bottomW),
    true,
  );
  shape.lineTo(pivotW, 0);
  shape.lineTo(rootW, -tail);
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, ringY, inner, 0, Math.PI * 2, false);
  shape.holes.push(hole);
  const raw = new THREE.ExtrudeGeometry(shape, {
    depth: thickness - 2 * bevel,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 20,
    steps: 1,
  });
  raw.translate(0, 0, bevel);
  return toCreasedNormals(normalize(raw), THREE.MathUtils.degToRad(22));
}
