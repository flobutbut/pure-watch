/**
 * Aiguilles. Chaque jeu est décrit par un profil symétrique (demi-largeur le long de
 * l'aiguille), pointe vers 12 h, pivot à l'origine (convention Figma, spec §8.2).
 * Une arête centrale optionnelle crée deux pans inclinés qui accrochent la lumière
 * (dauphine, feuille, épée). Les éléments non symétriques en largeur (anneau Breguet,
 * contrepoids) sont des formes extrudées fusionnées au profil.
 *
 * Quand les tracés Figma seront exportés, les profils pourront en être extraits ;
 * en attendant, ils sont dessinés ici en mm pour un cadran de rayon 20 mm.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HandAngles } from '../../core/clock/angles';
import type { WatchConfig } from '../../core/config/types';
import type { WatchDimensions } from '../../core/geometry/dimensions';
import { subdialCircle } from '../../core/config/small-seconds';
import type { MaterialLibrary } from '../materials';
import { subdialFloor } from './subdial';
import { buildReserveHand, stickHand } from './power-reserve';
import { reserveGauge } from '../../core/config/power-reserve';
import { subdialStyle } from '../../core/config/subdial-style';
import { subdialHand } from '../../core/config/subdial-hand';
import { chronoCounters } from '../../core/config/chronograph';
import { beveledProfile, piercedBreguet, piercedProfile } from './hand-detail';
import { beveledBaton, boss, disc, extruded, profileGeometry, type Sample } from './profile';
import { hasLume } from '../../core/config/lume';
import { bladeInsert, insertShape } from './inserts';
import { handAdjustment, handStyle } from '../../core/config/hands';
import { threeSpokeHand } from './three-spoke-hand';

interface HandDesign {
  samples: Sample[];
  ridge: number;
  extras?: THREE.BufferGeometry[];
  cutouts?: Sample[][];
}

/* ---------- Jeux d'aiguilles ---------- */

/** @param len longueur de l'aiguille, @param k échelle (rayon du cercle inscrit dans le cadran / 20 mm), @param s finesse (1 = heures) */
type DesignFn = (len: number, k: number, s: number, thickness: number) => HandDesign;

const DESIGNS: Record<string, DesignFn> = {
  baton: (len, k, s) => ({
    samples: [
      [-2.2 * k, 0.5 * k * s],
      [len, 0.5 * k * s],
    ],
    ridge: 0,
  }),
  sword: (len, k, s) => ({
    samples: [
      [-2.4 * k, 0.42 * k * s],
      [0, 0.5 * k * s],
      [0.3 * len, 0.82 * k * s],
      [0.86 * len, 0.5 * k * s],
      [len, 0],
    ],
    ridge: 0.12 * k,
  }),
  dauphine: (len, k, s) => ({
    samples: [
      [-2.0 * k, 0.32 * k * s],
      [0, 0.5 * k * s],
      [0.2 * len, 0.98 * k * s],
      [len, 0],
    ],
    ridge: 0.2 * k,
  }),
  leaf: (len, k, s) => {
    const samples: Sample[] = [
      [-2.0 * k, 0.32 * k * s],
      [0, 0.38 * k * s],
    ];
    for (let i = 1; i <= 16; i++) {
      const t = 0.08 + (0.92 * i) / 16;
      samples.push([
        t * len,
        Math.max(0.38 * k * s * (1 - t), 0.95 * k * s * Math.pow(Math.sin(Math.PI * t), 0.75)),
      ]);
    }
    return { samples, ridge: 0.15 * k };
  },
  syringe: (len, k, s) => ({
    samples: [
      [-2.0 * k, 0.32 * k * s],
      [0.12 * len, 0.3 * k * s],
      [0.16 * len, 0.72 * k * s],
      [0.78 * len, 0.72 * k * s],
      [0.82 * len, 0.22 * k * s],
      [0.92 * len, 0.16 * k * s],
      [len, 0],
    ],
    ridge: 0,
  }),
  breguet: (len, k, s, thickness) => {
    const ringY = 0.72 * len;
    const outer = 1.25 * k * s;
    const inner = 0.82 * k * s;
    return {
      samples: [
        [-2.0 * k, 0.32 * k * s],
        [0, 0.4 * k * s],
        [ringY - outer + 0.1 * k, 0.26 * k * s],
      ],
      ridge: 0.06 * k,
      extras: [
        extruded(disc(0, ringY, outer, inner), thickness),
        profileGeometry(
          [
            [ringY + outer - 0.1 * k, 0.3 * k * s],
            [len, 0],
          ],
          thickness,
          0.06 * k,
        ),
      ],
    };
  },
  spear: (len, k, s) => ({
    samples: [
      [-2 * k, 0.24 * k * s],
      [0, 0.32 * k * s],
      [0.48 * len, 0.28 * k * s],
      [0.55 * len, 1.15 * k * s],
      [0.64 * len, 1.0 * k * s],
      [len, 0],
    ],
    ridge: 0.12 * k,
  }),
  pencil: (len, k, s) => ({
    samples: [
      [-2.1 * k, 0.55 * k * s],
      [0.82 * len, 0.55 * k * s],
      [len, 0],
    ],
    ridge: 0.06 * k,
  }),
  spade: (len, k, s) => {
    const samples: Sample[] = [
      [-2 * k, 0.22 * k * s],
      [0, 0.3 * k * s],
      [0.5 * len, 0.24 * k * s],
    ];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      samples.push([
        (0.52 + t * 0.48) * len,
        (0.24 * (1 - t) + 1.15 * Math.sin(Math.PI * t) ** 0.8) * k * s,
      ]);
    }
    return { samples, ridge: 0.1 * k };
  },
  'art-deco': (len, k, s) => ({
    samples: [
      [-2 * k, 0.28 * k * s],
      [0.08 * len, 0.28 * k * s],
      [0.12 * len, 0.95 * k * s],
      [0.28 * len, 0.95 * k * s],
      [0.32 * len, 0.65 * k * s],
      [0.54 * len, 0.65 * k * s],
      [0.58 * len, 0.38 * k * s],
      [0.88 * len, 0.38 * k * s],
      [len, 0],
    ],
    ridge: 0.08 * k,
  }),
  skeleton: (len, k, s) => ({
    samples: [
      [-2 * k, 0.28 * k * s],
      [0, 0.48 * k * s],
      [0.18 * len, 0.95 * k * s],
      [0.82 * len, 0.6 * k * s],
      [len, 0],
    ],
    ridge: 0,
    cutouts: [
      [
        [0.23 * len, 0.48 * k * s],
        [0.73 * len, 0.3 * k * s],
        [0.86 * len, 0],
      ],
    ],
  }),
  cathedral: (len, k, s) => ({
    samples: [
      [-2 * k, 0.35 * k * s],
      [0, 0.55 * k * s],
      [0.17 * len, 0.95 * k * s],
      [0.4 * len, 0.95 * k * s],
      [0.44 * len, 0.62 * k * s],
      [0.68 * len, 0.62 * k * s],
      [0.73 * len, 1.15 * k * s],
      [0.79 * len, 1.05 * k * s],
      [len, 0],
    ],
    ridge: 0,
    cutouts: [
      [
        [0.21 * len, 0.46 * k * s],
        [0.35 * len, 0.46 * k * s],
      ],
      [
        [0.49 * len, 0.27 * k * s],
        [0.64 * len, 0.27 * k * s],
      ],
      [
        [0.735 * len, 0.45 * k * s],
        [0.79 * len, 0.45 * k * s],
        [0.89 * len, 0],
      ],
    ],
  }),
};

function buildHand(
  design: HandDesign,
  thickness: number,
  bossRadius: number,
): THREE.BufferGeometry {
  const parts = [
    design.cutouts
      ? piercedProfile(design.samples, design.cutouts, thickness)
      : profileGeometry(design.samples, thickness, design.ridge),
    ...(design.extras ?? []),
  ];
  parts.push(boss(bossRadius, thickness + 0.06));
  const merged = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  return merged;
}

/* ---------- Trotteuses (spec §5.9) ---------- */

type SecondFn = (len: number, tail: number, k: number, t: number) => THREE.BufferGeometry[];

const SECONDS: Record<string, SecondFn> = {
  // Fine : une aiguille effilée, courte queue.
  thin: (len, tail, k, t) => [
    profileGeometry(
      [
        [-tail * 0.6, 0.14 * k],
        [0, 0.13 * k],
        [len, 0.06 * k],
      ],
      t,
      0,
    ),
  ],
  // Contrepoids rond sur la queue.
  counterweight: (len, tail, k, t) => [
    profileGeometry(
      [
        [-tail, 0.2 * k],
        [0, 0.17 * k],
        [len, 0.08 * k],
      ],
      t,
      0,
    ),
    extruded(disc(0, -tail * 0.62, 0.8 * k), t),
  ],
  // Sucette : disque près de la pointe (porte le lume sur les plongeuses).
  lollipop: (len, tail, k, t) => [
    profileGeometry(
      [
        [-tail, 0.18 * k],
        [0, 0.15 * k],
        [len, 0.08 * k],
      ],
      t,
      0,
    ),
    extruded(disc(0, len * 0.8, 0.95 * k, 0.55 * k), t),
    extruded(disc(0, -tail * 0.62, 0.65 * k), t),
  ],
  // Flèche : pointe en fer de lance.
  arrow: (len, tail, k, t) => [
    profileGeometry(
      [
        [-tail * 0.7, 0.16 * k],
        [0, 0.14 * k],
        [len * 0.82, 0.1 * k],
        [len * 0.83, 0.62 * k],
        [len, 0],
      ],
      t,
      0,
    ),
  ],
  // Triangle plein près de la pointe (montres de pilote).
  triangle: (len, tail, k, t) => [
    profileGeometry(
      [
        [-tail, 0.18 * k],
        [0, 0.15 * k],
        [len, 0.07 * k],
      ],
      t,
      0,
    ),
    profileGeometry(
      [
        [len * 0.62, 0.85 * k],
        [len * 0.86, 0],
      ],
      t,
      0,
    ),
    extruded(disc(0, -tail * 0.62, 0.6 * k), t),
  ],
  baton: (len, tail, k, t) => [beveledBaton(len, tail * 0.75, 0.17 * k, t)],
  diamond: (len, tail, k, t) => [
    beveledProfile(
      [
        [-tail * 0.65, 0.12 * k],
        [0.65 * len, 0.12 * k],
        [0.74 * len, 0.92 * k],
        [0.83 * len, 0.12 * k],
        [len, 0.055 * k],
      ],
      t,
      0,
    ),
  ],
  teardrop: (len, tail, k, t) => [
    beveledProfile(
      [
        [-tail, 0],
        [-tail * 0.88, 0.58 * k],
        [-tail * 0.7, 0.8 * k],
        [-tail * 0.5, 0.62 * k],
        [-tail * 0.25, 0.12 * k],
        [0, 0.12 * k],
        [len, 0.055 * k],
      ],
      t,
      0,
      true,
    ),
  ],
  'ring-tail': (len, tail, k, t) => {
    const y = -tail * 0.7,
      r = 0.95 * k,
      w = 0.14 * k;
    const joinY = y + Math.sqrt(r * r - w * w);
    const shape = new THREE.Shape();
    shape.moveTo(-w, joinY);
    shape.lineTo(-0.055 * k, len);
    shape.lineTo(0.055 * k, len);
    shape.lineTo(w, joinY);
    shape.absarc(0, y, r, Math.atan2(joinY - y, w), Math.atan2(joinY - y, -w), true);
    shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, y, 0.56 * k, 0, Math.PI * 2, false);
    shape.holes.push(hole);
    return [extruded(shape, t)];
  },
  lightning: (len, tail, k, t) => {
    const points = [
      [0, -tail * 0.65],
      [0, 0],
      [-0.7 * k, len * 0.28],
      [0.7 * k, len * 0.43],
      [-0.7 * k, len * 0.58],
      [0.65 * k, len * 0.73],
      [0, len],
    ] as const;
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0] - 0.11 * k, points[0][1]);
    for (const [x, y] of points.slice(1)) shape.lineTo(x - 0.11 * k, y);
    for (const [x, y] of [...points].reverse()) shape.lineTo(x + 0.11 * k, y);
    shape.closePath();
    return [extruded(shape, t)];
  },
};

/* ---------- Montage ---------- */

export interface HandsParts {
  /** Heures, minutes et capuchon central. */
  group: THREE.Group;
  /** Trotteuse (calque séparé : ses propres lignes de configuration). */
  seconds: THREE.Group;
  setAngles(angles: HandAngles): void;
}

const Z_LEVELS = { hour: 0.55, minute: 0.85, second: 1.15, cap: 1.3 };
const DEG = Math.PI / 180;

export function buildHands(
  config: WatchConfig,
  d: WatchDimensions,
  lib: MaterialLibrary,
  refined = false,
  instrument = false,
  detailed = false,
): HandsParts {
  const k = d.dialSafeRadius / 20;
  const steel = lib.handMaterial(config, 'plain');
  const thick = refined ? 0.16 : 0.22;

  const machined = detailed || (instrument && config.hands.set === 'baton');
  const materials = machined
    ? [lib.handMaterial(config, 'face'), lib.handMaterial(config, 'edge')]
    : steel;
  const luminous = hasLume(config.hands);
  const blade = (
    part: 'hour' | 'minute',
    referenceLength: number,
    slimness: number,
    radius: number,
  ) => {
    const adjustment = handAdjustment(config.hands, part);
    const set = handStyle(config.hands, part);
    const length = referenceLength * adjustment.length;
    slimness *= adjustment.width;
    if (set === 'mercedes') return threeSpokeHand(length, k, slimness, thick, radius);
    const design = DESIGNS[set] ?? DESIGNS['sword']!;
    if (luminous) return buildLuminousHand(set, design, length, k, slimness, thick, radius);
    return {
      blade: detailed
        ? buildDetailedHand(set, design, length, k, slimness, thick, radius)
        : machined
          ? buildMachinedBaton(length, k, slimness, thick, radius)
          : buildHand(design(length, k, slimness, thick), thick, radius),
      insert: null,
    };
  };
  const hourParts = blade('hour', d.hands.hour, 1, (refined ? 0.88 : 1.45) * k);
  const minuteParts = blade('minute', d.hands.minute, 0.78, (refined ? 0.65 : 1.15) * k);
  const hour = new THREE.Mesh(hourParts.blade, materials);
  const minute = new THREE.Mesh(minuteParts.blade, materials);

  const secThick = 0.12;
  const subdial = subdialCircle(config, d.dialSafeRadius);
  const miniHand = subdialHand(config);
  const secondsChoice = subdial ? miniHand : config.hands.second;
  const secondDesign = SECONDS[secondsChoice.style] ?? SECONDS['counterweight']!;
  const secondParts =
    secondsChoice.style === 'none'
      ? []
      : subdial
        ? [
            ...secondDesign(subdial.r * 0.86, subdial.r * 0.26, k * 0.5, secThick),
            boss(0.42 * k, secThick + 0.05),
          ]
        : [
            ...secondDesign(d.hands.second, d.hands.secondTail, k, secThick),
            boss((refined ? 0.43 : 0.75) * k, secThick + 0.05),
          ];
  const secondGeometry = secondParts.length ? mergeGeometries(secondParts) : null;
  for (const g of secondParts) g.dispose();
  const color = secondsChoice.color;
  const second = secondGeometry
    ? new THREE.Mesh(secondGeometry, color === 'match' ? steel : lib.lacquer(color))
    : null;

  const cap = new THREE.Mesh(boss((refined ? 0.3 : 0.5) * k, refined ? 0.07 : 0.12), steel);

  const pivots = {
    hour: new THREE.Group(),
    minute: new THREE.Group(),
    second: new THREE.Group(),
  };
  pivots.hour.add(hour);
  pivots.minute.add(minute);
  for (const [name, parts, pivot] of [
    ['hour', hourParts, pivots.hour],
    ['minute', minuteParts, pivots.minute],
  ] as const) {
    if (!parts.insert) continue;
    const mesh = new THREE.Mesh(parts.insert, luminous ? lib.luminous(config.hands) : steel);
    mesh.name = `${name}-${luminous ? 'lume' : 'inset'}`;
    pivot.add(mesh);
  }
  if (second) pivots.second.add(second);
  // Gap exceeds the tallest facet (dauphine: 0.2*k) at every supported size.
  const levels = refined ? refinedHandLevels(k) : Z_LEVELS;
  hour.name = 'hour-blade';
  minute.name = 'minute-blade';
  if (second) second.name = 'second-blade';
  cap.name = 'pivot-cap';
  pivots.hour.position.z = levels.hour;
  pivots.minute.position.z = levels.minute;
  pivots.second.position.z = levels.second;
  if (subdial) {
    // Sous les aiguilles des heures, juste au-dessus du sous-cadran (ou de sa cuvette).
    pivots.second.position.set(subdial.x, subdial.y, subdialFloor(subdial.style) + 0.2);
  }
  cap.position.z = levels.cap;

  const group = new THREE.Group();
  group.name = 'hands';
  group.add(pivots.hour, pivots.minute, cap);
  const reserveChoice = subdialHand(config, true);
  const reserveMaterial = reserveChoice.color === 'match' ? steel : lib.matte(reserveChoice.color);
  const gauge = reserveGauge(config, d.dialSafeRadius);
  const reserve = buildReserveHand(
    config,
    d,
    reserveMaterial,
    gauge && config.details?.reserve?.handStyle && reserveChoice.style !== 'none'
      ? indicatorHand(reserveChoice.style, gauge.r * 0.9, gauge.r * 0.18, k, reserveMaterial)
      : undefined,
  );
  if (reserve) group.add(reserve);
  const seconds = new THREE.Group();
  seconds.name = 'seconds';
  if (second) seconds.add(pivots.second);

  // Chronographe au repos : trotteuse du chrono et compteurs à zéro ; les secondes
  // courantes tournent dans leur compteur.
  const counters = chronoCounters(config, d.dialSafeRadius);
  let running: THREE.Group | null = null;
  for (const c of counters) {
    if (miniHand.style === 'none') continue;
    const material = miniHand.color === 'match' ? steel : lib.lacquer(miniHand.color);
    let hand: THREE.Mesh;
    if (!config.details?.subdials?.hand?.style) {
      // Preserve the historical counter blade until its design is explicitly changed.
      hand = stickHand(c.r * 0.86, c.r * 0.22, k * 0.8, material);
    } else {
      hand = indicatorHand(miniHand.style, c.r * 0.86, c.r * 0.22, k * 0.5, material);
    }
    hand.name = `${c.kind}-counter-blade`;
    const pivot = new THREE.Group();
    pivot.name = `${c.kind}-counter`;
    pivot.position.set(c.x, c.y, subdialFloor(subdialStyle(config)) + 0.2);
    pivot.add(hand);
    if (c.kind === 'seconds') {
      running = pivot;
      seconds.add(pivot);
    } else group.add(pivot);
  }
  if (refined) group.scale.z = seconds.scale.z = Math.min(1, d.caseThickness / 11);

  return {
    group,
    seconds,
    setAngles(angles) {
      // Sens horaire vu de face (caméra sur +Z) = rotation négative autour de Z.
      pivots.hour.rotation.z = -angles.hour * DEG;
      pivots.minute.rotation.z = -angles.minute * DEG;
      if (counters.length) {
        if (running) running.rotation.z = -angles.second * DEG;
      } else pivots.second.rotation.z = -angles.second * DEG;
    },
  };
}

/** Same selectable designs for chronograph and reserve indicators. */
function indicatorHand(
  style: string,
  length: number,
  tail: number,
  k: number,
  material: THREE.Material,
) {
  const parts = (SECONDS[style] ?? SECONDS['baton']!)(length, tail, k, 0.12);
  parts.push(boss(0.42 * k, 0.17));
  const mesh = new THREE.Mesh(mergeGeometries(parts)!, material);
  for (const part of parts) part.dispose();
  return mesh;
}

export const HAND_SETS = Object.keys(DESIGNS);
export const SECOND_STYLES = [...Object.keys(SECONDS), 'none'];

/** Clearances are based on the maximum ridge across all available hand sets. */
export function refinedHandLevels(k: number) {
  const hour = 0.48;
  const minute = hour + 0.16 + 0.2 * k + 0.09;
  const second = minute + 0.16 + 0.2 * k + 0.09;
  return { hour, minute, second, cap: second + 0.18 };
}

function buildMachinedBaton(
  length: number,
  k: number,
  slimness: number,
  thickness: number,
  radius: number,
) {
  const blade = beveledBaton(length, 2.2 * k, 0.5 * k * slimness, thickness);
  const hub = boss(radius, thickness + 0.06);
  const merged = mergeGeometries([blade, hub]);
  // Keep just three contiguous groups; no per-segment draw calls.
  for (const group of blade.groups) merged.addGroup(group.start, group.count, group.materialIndex);
  merged.addGroup(blade.getAttribute('position').count, hub.getAttribute('position').count, 1);
  blade.dispose();
  hub.dispose();
  return merged;
}

function buildDetailedHand(
  set: string,
  design: DesignFn,
  length: number,
  k: number,
  slimness: number,
  thickness: number,
  radius: number,
) {
  let blade: THREE.BufferGeometry;
  if (set === 'baton') blade = beveledBaton(length, 2.2 * k, 0.5 * k * slimness, thickness);
  else if (set === 'breguet') blade = piercedBreguet(length, k, slimness, thickness);
  else {
    const shape = design(length, k, slimness, thickness);
    blade = shape.cutouts
      ? piercedProfile(shape.samples, shape.cutouts, thickness)
      : beveledProfile(shape.samples, thickness, shape.ridge, set === 'leaf' || set === 'spade');
  }
  const hub = boss(radius, thickness + 0.06);
  const merged = mergeGeometries([blade, hub]);
  const faceCount = blade.groups[0]!.count;
  merged.addGroup(0, faceCount, 0);
  merged.addGroup(faceCount, merged.getAttribute('position').count - faceCount, 1);
  blade.dispose();
  hub.dispose();
  return merged;
}

/** Each luminous fill occupies a real opening and stays below its enclosing metal edge. */
function buildLuminousHand(
  set: string,
  design: DesignFn,
  length: number,
  k: number,
  slimness: number,
  thickness: number,
  radius: number,
) {
  const shape = design(length, k, slimness, thickness);
  const holes = shape.cutouts ?? [bladeInsert(shape.samples, length)];
  const plates =
    set === 'breguet'
      ? [
          extruded(
            disc(
              0,
              length * 0.72,
              0.82 * k * slimness + Math.min(0.035, k * slimness * 0.055, thickness * 0.24),
            ),
            0.06,
          ),
        ]
      : holes.map((hole) => extruded(insertShape(hole), 0.06));
  const insert = mergeGeometries(plates);
  for (const g of plates) g.dispose();
  insert.translate(0, 0, thickness - 0.075);
  // Baton has a solid fast path, so use the pierced builder directly for all non-Breguet sets.
  const frame =
    set === 'breguet'
      ? piercedBreguet(length, k, slimness, thickness)
      : piercedProfile(shape.samples, holes, thickness);
  const hub = boss(radius, thickness + 0.06);
  const merged = mergeGeometries([frame, hub]);
  for (const group of frame.groups) merged.addGroup(group.start, group.count, group.materialIndex);
  merged.addGroup(frame.getAttribute('position').count, hub.getAttribute('position').count, 1);
  frame.dispose();
  hub.dispose();
  for (const extra of shape.extras ?? []) extra.dispose();
  return { blade: merged, insert };
}
