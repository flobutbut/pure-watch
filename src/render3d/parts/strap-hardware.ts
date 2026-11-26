import * as THREE from 'three';
import type { StrapConfig, WatchConfig } from '../../core/config/types';
import type { MaterialLibrary } from '../materials';
import { StrapBuilder, roundedRect } from './strap-geometry';
import { metalClasp } from './strap-metal';
import { buckleStrapEye, rolledStrapEnd, tongueSleeve } from './strap-attachments';

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
  if (strap.type === 'metal') {
    metalClasp(builder, strap, width, face, edge, recess);
    return;
  }
  const eye = strap.type !== 'metal' ? buckleStrapEye(strap.type, length) : null;
  const s = eye?.s ?? length - 7,
    w = width(s),
    z = top(0, s) + 0.25;
  if (eye)
    rolledStrapEnd(
      builder,
      eye,
      width,
      top,
      lib.strap(strap),
      lib.strap(strap, false, 'edge'),
      1,
      'strap-buckle-eye',
      strap.buckle === 'tang' ? 1.8 : 0,
      strap.type === 'leather' ? -0.36 : 0,
    );
  // The frame, axle and tongue are one rigid assembly anchored in the rolled strap end.
  const hardware = eye ? builder.rigid(s, eye.z) : builder;
  if (strap.buckle === 'deployant') {
    // Two recessed folding leaves underneath the cover and their transverse hinge pins.
    for (const offset of [-1, 1]) {
      hardware.extrude(
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
      hardware.pin(0, at, -0.25, w * 0.8, 0.6, 1, edge, 'strap-clasp-hinge');
    hardware.extrude(
      roundedRect(0, s - 12, w + 0.2, 16, 1.3),
      0.9,
      1,
      face,
      'strap-clasp',
      z,
      0.35,
      { edge },
    );
    hardware.extrude(
      roundedRect(0, s - 10, w - 2.2, 11.7, 0.8),
      0.2,
      1,
      face,
      'strap-clasp-cover',
      z + 1.22,
      0.17,
      { edge },
    );
    hardware.extrude(
      roundedRect(0, s - 13, w + 0.5, 3.5, 0.5),
      0.8,
      1,
      edge,
      'strap-safety-lock',
      z + 1.3,
      0.14,
    );
    for (const side of [-1, 1])
      hardware.pin(side * (w / 2 + 0.45), s - 5, z + 0.6, 1.4, 0.65, 1, edge, 'strap-clasp-button');
    for (const at of [s - 8.5, s - 7.7])
      hardware.box(0, at, z + 1.46, w * 0.3, 0.12, 0.04, 1, recess, 'strap-clasp-engraving');
  } else {
    const pivotZ = eye!.z,
      half = (w + 3.2) / 2,
      arm = 1.4,
      end = s + 9.2;
    // A U-frame closes around the pivot axle; material never fills the frame opening.
    const frame = new THREE.Shape();
    frame.moveTo(-half, s - 0.25);
    frame.lineTo(-half, end - 1.5);
    frame.quadraticCurveTo(-half, end, -half + 1.5, end);
    frame.lineTo(half - 1.5, end);
    frame.quadraticCurveTo(half, end, half, end - 1.5);
    frame.lineTo(half, s - 0.25);
    frame.quadraticCurveTo(half, s - 0.65, half - arm, s - 0.65);
    frame.lineTo(half - arm, end - 2.3);
    frame.quadraticCurveTo(half - arm, end - 1.65, half - arm - 0.65, end - 1.65);
    frame.lineTo(-half + arm + 0.65, end - 1.65);
    frame.quadraticCurveTo(-half + arm, end - 1.65, -half + arm, end - 2.3);
    frame.lineTo(-half + arm, s - 0.65);
    frame.quadraticCurveTo(-half, s - 0.65, -half, s - 0.25);
    frame.closePath();
    hardware.extrude(frame, 1.3, 1, face, 'strap-buckle', pivotZ - 0.65, 0.25, { edge });
    hardware.pin(0, s, pivotZ, w + 2.3, 0.54, 1, edge, 'strap-buckle-pivot');
    tongueSleeve(hardware, s, pivotZ, edge);
    const tongue = new THREE.Shape();
    tongue.moveTo(-0.48, s + 0.3);
    tongue.lineTo(0.48, s + 0.3);
    tongue.lineTo(0.4, s + 6.8);
    tongue.quadraticCurveTo(0.35, s + 8.9, 0, s + 8.9);
    tongue.quadraticCurveTo(-0.35, s + 8.9, -0.4, s + 6.8);
    tongue.closePath();
    hardware.extrude(tongue, 0.36, 1, edge, 'strap-pin', pivotZ + 0.72, 0.1, {
      lift: (_x, y, zz) =>
        zz +
        0.18 * Math.sin((Math.PI * (y - s)) / 9) -
        0.07 * THREE.MathUtils.smoothstep(y, s + 6.8, s + 8.9),
    });
    for (const side of [-1, 1])
      hardware.pin(side * (half + 0.06), s, pivotZ, 0.16, 0.7, 1, edge, 'strap-buckle-pivot-cap');
  }
  if (eye) {
    if (strap.buckle === 'deployant') {
      hardware.pin(0, s, eye.z, w + 2, 0.54, 1, edge, 'strap-clasp-mount');
      for (const side of [-1, 1])
        hardware.extrude(
          roundedRect(side * (w / 2 + 0.5), s - 7, 0.9, 7.6, 0.4),
          1.3,
          1,
          edge,
          'strap-clasp-mount-arm',
          eye.z - 0.65,
          0.12,
        );
    }
    builder.absorb(hardware);
  }
  if (strap.type === 'metal') return;
  // Closed rectangular keepers wrap the strap instead of sitting on it as solid blocks.
  const strapMaterial = lib.strap(strap),
    edgeMaterial = lib.strap(strap, false, 'edge');
  for (const [index, at] of [s - 11, s - 20].entries()) {
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
