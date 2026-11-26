import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js';

export type StrapPoint = (x: number, s: number, z: number, sign: number) => THREE.Vector3;
export interface StrapSurface {
  edge?: THREE.Material;
  /** Maximum edge length before bending long surfaces, in mm. */
  detail?: number;
  lift?: (x: number, s: number, z: number) => number;
}

/** Rounded outline in the strap's flat x/s coordinates. */
export function roundedRect(
  x: number,
  s: number,
  width: number,
  length: number,
  radius = 0.5,
): THREE.Shape {
  const shape = new THREE.Shape();
  const r = Math.max(0.01, Math.min(radius, width / 2 - 0.01, length / 2 - 0.01));
  const l = x - width / 2,
    right = x + width / 2,
    end = s + length;
  shape.moveTo(l + r, s);
  shape.lineTo(right - r, s);
  shape.quadraticCurveTo(right, s, right, s + r);
  shape.lineTo(right, end - r);
  shape.quadraticCurveTo(right, end, right - r, end);
  shape.lineTo(l + r, end);
  shape.quadraticCurveTo(l, end, l, end - r);
  shape.lineTo(l, s + r);
  shape.quadraticCurveTo(l, s, l + r, s);
  shape.closePath();
  return shape;
}

export function roundHole(shape: THREE.Shape, x: number, s: number, radius: number): void {
  const path = new THREE.Path();
  path.absellipse(x, s, radius, radius, 0, Math.PI * 2, true, 0);
  shape.holes.push(path);
}

/** Collect in flat coordinates, bend, then batch: detail never adds a draw call per stitch. */
export class StrapBuilder {
  readonly root = Object.assign(new THREE.Group(), { name: 'strap' });
  private readonly batches = new Map<
    string,
    { name: string; material: THREE.Material; geometries: THREE.BufferGeometry[] }
  >();
  constructor(readonly point: StrapPoint) {}

  geometry(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    name: string,
    sign: number,
    lift?: StrapSurface['lift'],
  ): void {
    const pos = geometry.attributes.position!;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        s = pos.getY(i),
        z = pos.getZ(i);
      // A texture tile covers eight millimetres on every model, independent of its size.
      uv[i * 2] = x / 8;
      uv[i * 2 + 1] = s / 8;
      const p = this.point(x, s, lift ? lift(x, s, z) : z, sign);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    const key = `${name}:${material.uuid}`;
    const batch = this.batches.get(key) ?? { name, material, geometries: [] };
    batch.geometries.push(geometry);
    this.batches.set(key, batch);
  }

  extrude(
    shape: THREE.Shape,
    depth: number,
    sign: number,
    material: THREE.Material,
    name: string,
    z = 0,
    bevel = 0.18,
    surface: StrapSurface = {},
  ): void {
    const raw = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 2,
      steps: 1,
      curveSegments: name === 'strap-link' ? 4 : 6,
    });
    // Separate the cut/painted edge from the face before tessellation discards groups.
    for (const part of raw.groups) {
      let geometry: THREE.BufferGeometry = new THREE.BufferGeometry();
      for (const attr of ['position', 'normal', 'uv']) {
        const source = raw.attributes[attr]!;
        geometry.setAttribute(
          attr,
          new THREE.BufferAttribute(
            new Float32Array(
              source.array.slice(
                part.start * source.itemSize,
                (part.start + part.count) * source.itemSize,
              ),
            ),
            source.itemSize,
          ),
        );
      }
      // ExtrudeGeometry adds bevelThickness outside [0, depth]. Keep the requested
      // physical thickness exact so stitching, yarns and dyed strips stay above the face.
      if (bevel > 0) {
        const scale = depth / (depth + 2 * bevel);
        geometry.scale(1, 1, scale);
        geometry.translate(0, 0, bevel * scale);
      }
      if (surface.detail) {
        const old = geometry;
        geometry = new TessellateModifier(surface.detail, 8).modify(old);
        old.dispose();
      }
      const old = geometry;
      geometry = mergeVertices(old, 0.0001);
      old.dispose();
      geometry.translate(0, 0, z);
      this.geometry(
        geometry,
        part.materialIndex === 1 && surface.edge ? surface.edge : material,
        name,
        sign,
        surface.lift,
      );
    }
    raw.dispose();
  }

  tube(
    points: THREE.Vector3[],
    radius: number,
    sign: number,
    material: THREE.Material,
    name: string,
    radialSegments = 6,
    longitudinalScale = 2,
  ): void {
    if (points.length < 2) return;
    const path = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    path.arcLengthDivisions = Math.max(12, points.length * 2);
    this.geometry(
      new THREE.TubeGeometry(
        path,
        Math.max(3, Math.ceil(points.length * longitudinalScale)),
        radius,
        radialSegments,
        false,
      ),
      material,
      name,
      sign,
    );
  }

  box(
    x: number,
    s: number,
    z: number,
    width: number,
    length: number,
    depth: number,
    sign: number,
    material: THREE.Material,
    name: string,
  ): void {
    const geometry = new THREE.BoxGeometry(width, length, depth);
    geometry.translate(x, s, z);
    this.geometry(geometry, material, name, sign);
  }

  pin(
    x: number,
    s: number,
    z: number,
    length: number,
    radius: number,
    sign: number,
    material: THREE.Material,
    name: string,
  ): void {
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 12, 1, false);
    geometry.rotateZ(Math.PI / 2);
    geometry.translate(x, s, z);
    this.geometry(geometry, material, name, sign);
  }

  /** Metal hardware follows the attachment's tangent as a rigid piece. */
  rigid(s: number, z: number, sign = 1): StrapBuilder {
    const origin = this.point(0, s, z, sign);
    const xAxis = this.point(1, s, z, sign).sub(origin).normalize();
    const tangent = this.point(0, s + 0.05, z, sign)
      .sub(this.point(0, s - 0.05, z, sign))
      .normalize();
    const normal = xAxis.clone().cross(tangent).normalize();
    return new StrapBuilder((x, ss, zz) =>
      origin
        .clone()
        .addScaledVector(xAxis, x)
        .addScaledVector(tangent, ss - s)
        .addScaledVector(normal, zz - z),
    );
  }

  absorb(builder: StrapBuilder): void {
    const root = builder.finish();
    for (const child of [...root.children]) {
      if (child instanceof THREE.Mesh && !Array.isArray(child.material)) {
        const key = `${child.name}:${child.material.uuid}`;
        const batch = this.batches.get(key) ?? {
          name: child.name,
          material: child.material,
          geometries: [] as THREE.BufferGeometry[],
        };
        batch.geometries.push(child.geometry);
        this.batches.set(key, batch);
        root.remove(child);
      } else this.root.add(child);
    }
  }

  finish(): THREE.Group {
    for (const batch of this.batches.values()) {
      const geometry = mergeGeometries(batch.geometries);
      for (const original of batch.geometries) original.dispose();
      if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, batch.material);
      mesh.name = batch.name;
      this.root.add(mesh);
    }
    this.batches.clear();
    return this.root;
  }
}
