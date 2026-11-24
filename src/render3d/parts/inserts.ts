/** Flat, physically separate pigment inserts enclosed by a metal rim. */
import * as THREE from 'three';
import { extruded, type Sample } from './profile';

/** The applied index designs have convex silhouettes; facets and Z must not alter them. */
export function indexOutline(geometry: THREE.BufferGeometry): THREE.Vector2[] {
  const p = geometry.getAttribute('position');
  const unique = new Map<string, THREE.Vector2>();
  for (let i = 0; i < p.count; i++) {
    const x = Math.round(p.getX(i) * 1e6) / 1e6;
    const y = Math.round(p.getY(i) * 1e6) / 1e6;
    unique.set(`${x},${y}`, new THREE.Vector2(x, y));
  }
  const points = [...unique.values()].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (list: THREE.Vector2[]) => {
    const hull: THREE.Vector2[] = [];
    for (const v of list) {
      while (hull.length >= 2 && cross(hull.at(-2)!, hull.at(-1)!, v) <= 0) hull.pop();
      hull.push(v);
    }
    return hull.slice(0, -1);
  };
  return [...half(points), ...half([...points].reverse())];
}

export function indexPlate(geometry: THREE.BufferGeometry, luminous: boolean, printed: boolean) {
  const outline = indexOutline(geometry);
  const shape = new THREE.Shape(outline);
  const height = printed ? 0.025 : 0.3;
  if (!luminous || printed) return { base: extruded(shape, height), insert: null };
  const inner = outline.map((p) => new THREE.Vector2(p.x * 0.64, p.y * 0.75));
  shape.holes.push(new THREE.Path(inner));
  const insert = extruded(new THREE.Shape(inner), 0.075);
  insert.translate(0, 0, height - 0.085);
  return { base: extruded(shape, height), insert };
}

/** Clip along the blade, preserving every change of width rather than drawing a generic bar. */
export function bladeInsert(samples: readonly Sample[], length: number): Sample[] {
  const lo = length * 0.19;
  const hi = length * 0.88;
  const widthAt = (y: number) => {
    for (let i = 1; i < samples.length; i++) {
      const [a, wa] = samples[i - 1]!;
      const [b, wb] = samples[i]!;
      if (y <= b) return wa + ((wb - wa) * (y - a)) / (b - a);
    }
    return samples.at(-1)![1];
  };
  return [
    [lo, widthAt(lo) * 0.54],
    ...samples.filter(([y]) => y > lo && y < hi).map(([y, w]) => [y, w * 0.54] as Sample),
    [hi, widthAt(hi) * 0.54],
  ];
}

export function insertShape(samples: readonly Sample[]): THREE.Shape {
  const outline = [
    ...samples.map(([y, w]) => new THREE.Vector2(-w, y)),
    ...[...samples].reverse().map(([y, w]) => new THREE.Vector2(w, y)),
  ];
  return new THREE.Shape(outline);
}
