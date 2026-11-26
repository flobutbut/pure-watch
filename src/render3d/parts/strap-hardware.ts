import * as THREE from 'three';
import type { StrapConfig, WatchConfig } from '../../core/config/types';
import type { MaterialLibrary } from '../materials';
import { StrapBuilder, roundedRect } from './strap-geometry';

/** A real frame, pivot bar and profiled tongue; a deployant has hinged folding blades. */
export function strapHardware(
  builder: StrapBuilder,
  config: WatchConfig,
  strap: StrapConfig,
  lib: MaterialLibrary,
  length: number,
  width: (s: number) => number,
  top: (x: number, s: number) => number,
): void {
  const match = strap.buckleFinish === 'case';
  const hardwareConfig = match
    ? config
    : {
        ...config,
        case: {
          ...config.case,
          material: strap.buckleFinish === 'black' ? 'steel' : strap.buckleFinish!,
          finish: strap.buckleFinish === 'black' ? 'pvd-black' : 'brushed',
        },
      };
  const face = lib.caseMetal(hardwareConfig, 'brushed'),
    edge = lib.caseMetal(hardwareConfig, 'jewel');
  const recess = lib.matte('#24272B');
  const s = length - 7,
    w = width(s),
    z = top(0, s) + 0.25;
  if (strap.buckle === 'deployant') {
    // Two recessed folding leaves underneath the cover and their transverse hinge pins.
    for (const offset of [-1, 1]) {
      builder.extrude(
        roundedRect(offset * w * 0.3, s - 23, w * 0.21, 24, 0.8),
        0.75,
        1,
        face,
        'strap-folding-blade',
        -0.7,
        0.12,
        { edge },
      );
    }
    for (const at of [s - 23, s - 10, s + 1])
      builder.pin(0, at, -0.25, w * 0.8, 0.6, 1, edge, 'strap-clasp-hinge');
    builder.extrude(
      roundedRect(0, s - 12, w + 0.2, 16, 1.3),
      0.9,
      1,
      face,
      'strap-clasp',
      z,
      0.35,
      { edge },
    );
    builder.extrude(
      roundedRect(0, s - 10, w - 2.2, 11.7, 0.8),
      0.2,
      1,
      face,
      'strap-clasp-cover',
      z + 1.22,
      0.17,
      { edge },
    );
    builder.extrude(
      roundedRect(0, s - 13, w + 0.5, 3.5, 0.5),
      0.8,
      1,
      edge,
      'strap-safety-lock',
      z + 1.3,
      0.14,
    );
    for (const side of [-1, 1])
      builder.pin(side * (w / 2 + 0.45), s - 5, z + 0.6, 1.4, 0.65, 1, edge, 'strap-clasp-button');
    for (const at of [s - 8.5, s - 7.7])
      builder.box(0, at, z + 1.46, w * 0.3, 0.12, 0.04, 1, recess, 'strap-clasp-engraving');
  } else {
    const outer = roundedRect(0, s - 1, w + 3.1, 10, 1.7);
    const inner = roundedRect(0, s + 0.45, w + 0.1, 6.8, 1.0);
    // Reverse the inner path so the frame is a genuine opening.
    const hole = new THREE.Path(inner.getPoints().reverse());
    outer.holes.push(hole);
    builder.extrude(outer, 1.25, 1, face, 'strap-buckle', z, 0.3, { edge });
    builder.pin(0, s + 0.4, z + 0.6, w + 2.1, 0.65, 1, edge, 'strap-buckle-pivot');
    const tongue = new THREE.Shape();
    tongue.moveTo(-0.55, s - 0.1);
    tongue.lineTo(0.55, s - 0.1);
    tongue.lineTo(0.42, s + 7.3);
    tongue.quadraticCurveTo(0, s + 8, -0.42, s + 7.3);
    tongue.closePath();
    builder.extrude(tongue, 0.65, 1, edge, 'strap-pin', z + 1.1, 0.14, {
      lift: (_x, y, zz) => zz + Math.sin((Math.max(0, y - s) / 8) * Math.PI) * 0.25,
    });
    for (const side of [-1, 1])
      builder.pin(
        side * (w / 2 + 1.5),
        s + 0.4,
        z + 0.6,
        0.22,
        0.8,
        1,
        edge,
        'strap-buckle-pivot-cap',
      );
  }
  if (strap.type === 'metal') return;
  // Closed rectangular keepers wrap the strap instead of sitting on it as solid blocks.
  const strapMaterial = lib.strap(strap),
    edgeMaterial = lib.strap(strap, false, 'edge');
  for (const [index, at] of [s - 16, s - 26].entries()) {
    const keeperWidth = width(at) + 0.9,
      keeperHeight = top(0, at) + 1.1;
    const shape = roundedRect(0, -0.6, keeperWidth + 1.3, keeperHeight + 1.5, 0.85);
    const opening = roundedRect(0, 0, keeperWidth, keeperHeight, 0.45);
    shape.holes.push(new THREE.Path(opening.getPoints().reverse()));
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: index === 0 ? 3.4 : 4,
      bevelEnabled: true,
      bevelSize: 0.12,
      bevelThickness: 0.12,
      bevelSegments: 2,
      curveSegments: 8,
    });
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, at + 3.5, 0);
    builder.geometry(geometry, strapMaterial, 'strap-keeper', 1);
    if (strap.type === 'leather')
      builder.tube(
        [
          new THREE.Vector3(-keeperWidth / 2, at + 0.4, keeperHeight + 0.8),
          new THREE.Vector3(0, at + 0.4, keeperHeight + 0.9),
          new THREE.Vector3(keeperWidth / 2, at + 0.4, keeperHeight + 0.8),
        ],
        0.065,
        1,
        edgeMaterial,
        'strap-keeper-edge',
        5,
      );
  }
}

/** End-piece spring bars are visible only at the edges, with a recessed axle. */
export function strapSpringBar(
  builder: StrapBuilder,
  lib: MaterialLibrary,
  config: WatchConfig,
  width: number,
  sign: number,
  s: number,
  z: number,
): void {
  const face = lib.caseMetal(config, 'satin'),
    polish = lib.caseMetal(config, 'jewel');
  builder.pin(0, s, z, width + 0.35, 0.52, sign, face, 'strap-spring-bar');
  for (const side of [-1, 1])
    builder.pin(side * (width / 2 + 0.2), s, z, 0.65, 0.3, sign, polish, 'strap-spring-bar-tip');
}
