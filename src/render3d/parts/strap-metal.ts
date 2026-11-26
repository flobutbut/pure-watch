/** Hinged steel end pieces, crimped mesh sleeves and a clasp joining both bracelet halves. */
import * as THREE from 'three';
import type { StrapConfig } from '../../core/config/types';
import { STRAP_LENGTHS } from '../../core/config/strap';
import { StrapBuilder, roundedRect } from './strap-geometry';
import { hingeSleeve } from './strap-attachments';

export const METAL_ROOT_HINGE = { s: 3.7, z: 1.4 };
export const METAL_FIRST_LINK = 4.65;
export function metalTerminal(strap: StrapConfig, length: number) {
  return {
    s: length - 2.6,
    z: strap.material === 'mesh' ? 0.85 : 1.4,
    radius: strap.material === 'mesh' ? 0.85 : 1.1,
  };
}
export function metalBandEnd(strap: StrapConfig, length: number): number {
  return metalTerminal(strap, length).s - (strap.material === 'mesh' ? 0.8 : 2.3);
}

/** Central fixed knuckle and two moving outer knuckles alternate along the same pin. */
export function metalRootHinge(
  builder: StrapBuilder,
  width: number,
  centreFraction: number,
  sign: number,
  face: THREE.Material,
  edge: THREE.Material,
): void {
  const { s, z } = METAL_ROOT_HINGE,
    rigid = builder.rigid(s, z, sign);
  const centreWidth = width * centreFraction;
  hingeSleeve(rigid, 0, centreWidth - 0.24, s, z, 1.1, 0.6, face, 'strap-link-knuckle');
  const outside = (width - centreWidth) / 2;
  for (const side of [-1, 1])
    hingeSleeve(
      rigid,
      (side * (centreWidth + outside)) / 2,
      outside - 0.24,
      s,
      z,
      1.1,
      0.6,
      face,
      'strap-link-knuckle',
    );
  rigid.pin(0, s, z, width + 0.1, 0.5, 1, edge, 'strap-link-hinge');
  for (const side of [-1, 1])
    rigid.pin(side * (width / 2 + 0.12), s, z, 0.18, 0.68, 1, edge, 'strap-link-hinge');
  builder.absorb(rigid);
}

/** Folded steel channel grips the woven wires, with a cylindrical eye at the spring bar. */
export function meshRootAttachment(
  builder: StrapBuilder,
  width: number,
  s: number,
  z: number,
  sign: number,
  face: THREE.Material,
  edge: THREE.Material,
): void {
  const rigid = builder.rigid(s, z, sign);
  hingeSleeve(rigid, 0, width - 0.2, s, z, 0.95, 0.64, face, 'strap-mesh-eye');
  meshChannel(rigid, width, s + 0.85, 2.8, face, edge);
  builder.absorb(rigid);
}
function meshChannel(
  builder: StrapBuilder,
  width: number,
  s: number,
  length: number,
  face: THREE.Material,
  edge: THREE.Material,
): void {
  builder.extrude(
    roundedRect(0, s, width - 0.2, length, 0.25),
    0.3,
    1,
    face,
    'strap-mesh-clamp',
    0,
    0.08,
    { edge },
  );
  builder.extrude(
    roundedRect(0, s, width - 0.2, length, 0.25),
    0.28,
    1,
    face,
    'strap-mesh-clamp',
    1.32,
    0.08,
    { edge },
  );
  for (const side of [-1, 1])
    builder.extrude(
      roundedRect(side * (width / 2 - 0.25), s, 0.45, length, 0.15),
      1.6,
      1,
      face,
      'strap-mesh-clamp',
      0,
      0.06,
      { edge },
    );
}

/** A terminal link stops before the axle bore; the clasp forks close around its ends. */
export function metalTerminalAttachment(
  builder: StrapBuilder,
  strap: StrapConfig,
  length: number,
  width: number,
  sign: number,
  face: THREE.Material,
  edge: THREE.Material,
): void {
  const terminal = metalTerminal(strap, length),
    rigid = builder.rigid(terminal.s, terminal.z, sign);
  if (strap.material === 'mesh') meshChannel(rigid, width, terminal.s - 3.55, 2.8, face, edge);
  else
    rigid.extrude(
      roundedRect(0, terminal.s - 3.4, width - 0.2, 2.6, 0.4),
      2.6,
      1,
      face,
      'strap-end-link',
      0,
      0.16,
      { edge },
    );
  if (sign === 1)
    hingeSleeve(
      rigid,
      0,
      width * 0.58,
      terminal.s,
      terminal.z,
      terminal.radius,
      0.6,
      face,
      'strap-link-knuckle',
    );
  else
    for (const offset of [-0.4, 0, 0.4])
      hingeSleeve(
        rigid,
        offset * width,
        width * 0.18,
        terminal.s,
        terminal.z,
        terminal.radius,
        0.6,
        face,
        'strap-link-knuckle',
      );
  builder.absorb(rigid);
}

/** A rigid deployant between the actual two end axles, with two articulated folding leaves. */
export function metalClasp(
  builder: StrapBuilder,
  strap: StrapConfig,
  width: (s: number) => number,
  face: THREE.Material,
  edge: THREE.Material,
  recess: THREE.Material,
): void {
  const lengths = STRAP_LENGTHS[strap.length ?? 'standard'];
  const aEnd = metalTerminal(strap, lengths[0]),
    bEnd = metalTerminal(strap, lengths[1]);
  const a = builder.point(0, aEnd.s, aEnd.z, 1),
    b = builder.point(0, bEnd.s, bEnd.z, -1);
  const xAxis = builder.point(1, aEnd.s, aEnd.z, 1).sub(a).normalize();
  const tangent = b.clone().sub(a).normalize(),
    normal = xAxis.clone().cross(tangent).normalize();
  const middle = a.clone().add(b).multiplyScalar(0.5);
  const w = Math.min(width(aEnd.s), width(bEnd.s));
  const clasp = new StrapBuilder((x, s, z) =>
    middle.clone().addScaledVector(xAxis, x).addScaledVector(tangent, s).addScaledVector(normal, z),
  );
  // Short rimmed shell and a flush inset cover, both independent of the wrist's curve.
  clasp.extrude(roundedRect(0, -8, w + 0.8, 16, 1.1), 0.8, 1, face, 'strap-clasp', -0.7, 0.25, {
    edge,
  });
  for (const side of [-1, 1])
    clasp.extrude(
      roundedRect(side * (w / 2 - 0.1), -7.6, 0.8, 15.2, 0.3),
      0.9,
      1,
      face,
      'strap-clasp',
      -0.15,
      0.1,
      { edge },
    );
  clasp.extrude(
    roundedRect(0, -7.1, w - 1.1, 14.2, 0.7),
    0.35,
    1,
    face,
    'strap-clasp-cover',
    0.65,
    0.14,
    { edge },
  );
  clasp.extrude(
    roundedRect(0, -8.6, w + 1.1, 3.4, 0.5),
    0.45,
    1,
    edge,
    'strap-safety-lock',
    1.0,
    0.14,
  );
  clasp.pin(0, -6.8, 1.1, w + 0.4, 0.35, 1, edge, 'strap-clasp-hinge');
  for (const side of [-1, 1])
    clasp.pin(side * (w / 2 + 0.55), 1.5, 0.2, 1.05, 0.55, 1, edge, 'strap-clasp-button');
  for (const at of [-2.5, -1.7])
    clasp.box(0, at, 1.01, w * 0.28, 0.11, 0.025, 1, recess, 'strap-clasp-engraving');
  const folded = middle.clone().addScaledVector(normal, -1.5);
  clasp.pin(0, 0, -1.5, w + 1.3, 0.5, 1, edge, 'strap-clasp-hinge');
  hingeSleeve(clasp, 0, w * 0.16, 0, -1.5, 1.05, 0.6, edge, 'strap-clasp-hinge');
  builder.absorb(clasp);
  // Each leaf is rigid too: the articulation happens at the three transverse axles.
  for (const [index, end] of [a, b].entries()) {
    const direction = folded.clone().sub(end).normalize(),
      n = xAxis.clone().cross(direction).normalize();
    const distance = end.distanceTo(folded);
    const leaf = new StrapBuilder((x, s, z) =>
      end.clone().addScaledVector(xAxis, x).addScaledVector(direction, s).addScaledVector(n, z),
    );
    const offset = index === 0 ? 0.4 : 0.2;
    for (const side of [-1, 1]) {
      leaf.extrude(
        roundedRect(side * w * offset, 0.75, w * 0.18, distance - 1.5, 0.4),
        0.55,
        1,
        face,
        'strap-folding-blade',
        -0.275,
        0.1,
        { edge },
      );
      for (const at of [0, distance])
        hingeSleeve(leaf, side * w * offset, w * 0.18, at, 0, 0.8, 0.6, face, 'strap-clasp-eye');
    }
    leaf.pin(0, 0, 0, w + 1.3, 0.5, 1, edge, 'strap-clasp-mount');
    for (const side of [-1, 1])
      leaf.pin(side * (w / 2 + 0.5), 0, 0, 0.15, 0.66, 1, edge, 'strap-hinge-cap');
    builder.absorb(leaf);
  }
}
