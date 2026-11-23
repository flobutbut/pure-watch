/**
 * Pièces plates symétriques décrites par un profil (demi-largeur le long d'un axe), avec
 * une arête centrale optionnelle qui crée deux pans inclinés. Sert aux aiguilles et aux
 * index appliqués. Repère : axe de la pièce = +Y, base en z = 0, dessus en z = épaisseur.
 */
import * as THREE from 'three';

export type Sample = readonly [y: number, halfWidth: number];

const EPS = 1e-9;

export function profileGeometry(
  samples: readonly Sample[],
  thickness: number,
  ridge: number,
): THREE.BufferGeometry {
  const maxW = Math.max(...samples.map(([, w]) => w)) || 1;
  const positions: number[] = [];
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();

  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, expected: THREE.Vector3) => {
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    n.crossVectors(ab, ac);
    if (n.lengthSq() < EPS) return; // triangle dégénéré (pointe)
    const [p, q] = n.dot(expected) >= 0 ? [b, c] : [c, b];
    positions.push(a.x, a.y, a.z, p.x, p.y, p.z, q.x, q.y, q.z);
  };
  const quad = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: THREE.Vector3,
    e: THREE.Vector3,
  ) => {
    tri(a, b, c, e);
    tri(a, c, d, e);
  };

  const ring = samples.map(([y, w]) => ({
    lt: new THREE.Vector3(-w, y, thickness),
    ct: new THREE.Vector3(0, y, thickness + ridge * (w / maxW)),
    rt: new THREE.Vector3(w, y, thickness),
    lb: new THREE.Vector3(-w, y, 0),
    rb: new THREE.Vector3(w, y, 0),
  }));

  const UP = new THREE.Vector3(0, 0, 1);
  const DOWN = new THREE.Vector3(0, 0, -1);
  const LEFT = new THREE.Vector3(-1, 0, 0);
  const RIGHT = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    quad(a.lt, b.lt, b.ct, a.ct, UP);
    quad(a.ct, b.ct, b.rt, a.rt, UP);
    quad(a.lb, b.lb, b.lt, a.lt, LEFT);
    quad(a.rb, a.rt, b.rt, b.rb, RIGHT);
    quad(a.lb, a.rb, b.rb, b.lb, DOWN);
  }
  const caps: [(typeof ring)[number] | undefined, THREE.Vector3][] = [
    [ring[0], new THREE.Vector3(0, -1, 0)],
    [ring[ring.length - 1], new THREE.Vector3(0, 1, 0)],
  ];
  for (const [end, dir] of caps) {
    if (!end) continue;
    quad(end.lb, end.rb, end.rt, end.lt, dir);
    tri(end.lt, end.rt, end.ct, dir);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals(); // non indexée : facettes nettes
  return geometry;
}

/** Forme plane extrudée sur l'épaisseur de l'aiguille, au format du profil (non indexée, sans UV). */
export function extruded(shape: THREE.Shape, thickness: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 32,
  });
  return normalize(g);
}

export function normalize(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  out.deleteAttribute('uv');
  out.computeVertexNormals();
  return out;
}

export function disc(cx: number, cy: number, r: number, hole = 0): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(cx, cy, r, 0, Math.PI * 2, false);
  if (hole > 0) {
    const h = new THREE.Path();
    h.absarc(cx, cy, hole, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  return s;
}

/** Canon central (bossage) qui couvre le pivot. */
export function boss(r: number, height: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, height, 48);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, height / 2);
  return normalize(g);
}

/** Flat baton with a 45-degree edge break, preserving its plan silhouette and reach. */
export function beveledBaton(
  length: number,
  tail: number,
  halfWidth: number,
  thickness: number,
): THREE.BufferGeometry {
  const bevel = Math.min(0.055, halfWidth * 0.18, thickness * 0.3);
  const shape = new THREE.Shape();
  const w = halfWidth - bevel;
  shape.moveTo(-w, -tail + bevel);
  shape.lineTo(w, -tail + bevel);
  shape.lineTo(w, length - bevel);
  shape.lineTo(-w, length - bevel);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness - 2 * bevel,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 1,
  });
  geometry.translate(0, 0, bevel);
  // ExtrudeGeometry groups: flat end faces (0), sides and bevels (1).
  return normalize(geometry);
}
