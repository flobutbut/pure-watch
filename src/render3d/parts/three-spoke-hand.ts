import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { boss, extruded, type Sample } from './profile';
import { insertShape } from './inserts';

/** Circular head with three real recessed sectors, joined to a pointed stem. */
export function threeSpokeHand(
  length: number,
  k: number,
  width: number,
  thickness: number,
  hubRadius: number,
) {
  const cy = length * 0.66;
  const ry = Math.min(1.65 * k, length * 0.19),
    rx = ry * width;
  const samples: Sample[] = [
    [-2 * k, 0.32 * k * width],
    [0, 0.42 * k * width],
    [cy - ry, 0.42 * k * width],
  ];
  for (let i = 0; i <= 24; i++) {
    const t = -0.94 + (1.88 * i) / 24;
    samples.push([cy + t * ry, rx * Math.sqrt(1 - t * t)]);
  }
  samples.push([cy + ry, 0.28 * k * width], [length, 0]);
  const shape = insertShape(samples);
  const holes: THREE.Shape[] = [];
  holes.push(
    insertShape([
      [length * 0.19, 0.2 * k * width],
      [cy - ry - 0.12 * k, 0.2 * k * width],
    ]),
  );
  for (let sector = 0; sector < 3; sector++) {
    const start = Math.PI / 2 + (sector * 2 * Math.PI) / 3 + 0.11;
    const end = start + (2 * Math.PI) / 3 - 0.22;
    const points: THREE.Vector2[] = [];
    const at = (a: number, r: number) =>
      new THREE.Vector2(rx * Math.cos(a) * r, cy + ry * Math.sin(a) * r);
    points.push(at(start, 0.16));
    for (let i = 0; i <= 18; i++) points.push(at(start + ((end - start) * i) / 18, 0.74));
    points.push(at(end, 0.16));
    holes.push(new THREE.Shape(points));
  }
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.getPoints()));
  const frame = extruded(shape, thickness),
    hub = boss(hubRadius, thickness + 0.06);
  const blade = mergeGeometries([frame, hub]);
  for (const group of frame.groups) blade.addGroup(group.start, group.count, group.materialIndex);
  blade.addGroup(frame.getAttribute('position').count, hub.getAttribute('position').count, 1);
  const plates = holes.map((h) => extruded(h, 0.06));
  const insert = mergeGeometries(plates);
  insert.translate(0, 0, thickness - 0.075);
  frame.dispose();
  hub.dispose();
  plates.forEach((p) => p.dispose());
  return { blade, insert };
}
