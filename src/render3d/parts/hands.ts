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
import type { MaterialLibrary } from '../materials';
import { beveledProfile, piercedBreguet } from './hand-detail';
import { beveledBaton, boss, disc, extruded, profileGeometry, type Sample } from './profile';

interface HandDesign {
  samples: Sample[];
  ridge: number;
  extras?: THREE.BufferGeometry[];
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
};

function buildHand(
  design: HandDesign,
  thickness: number,
  bossRadius: number,
): THREE.BufferGeometry {
  const parts = [
    profileGeometry(design.samples, thickness, design.ridge),
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
  const design = DESIGNS[config.hands.set] ?? DESIGNS['sword']!;
  const steel = lib.polishedSteel();
  const thick = refined ? 0.16 : 0.22;

  const machined = detailed || (instrument && config.hands.set === 'baton');
  const materials = machined ? [lib.handSteel('face'), lib.handSteel('edge')] : steel;
  const blade = (length: number, slimness: number, radius: number) =>
    detailed
      ? buildDetailedHand(config.hands.set, design, length, k, slimness, thick, radius)
      : machined
        ? buildMachinedBaton(length, k, slimness, thick, radius)
        : buildHand(design(length, k, slimness, thick), thick, radius);
  const hour = new THREE.Mesh(blade(d.hands.hour, 1, (refined ? 0.88 : 1.45) * k), materials);
  const minute = new THREE.Mesh(
    blade(d.hands.minute, 0.78, (refined ? 0.65 : 1.15) * k),
    materials,
  );

  const secThick = 0.12;
  const secondDesign = SECONDS[config.hands.second.style] ?? SECONDS['counterweight']!;
  const secondParts = [
    ...secondDesign(d.hands.second, d.hands.secondTail, k, secThick),
    boss((refined ? 0.43 : 0.75) * k, secThick + 0.05),
  ];
  const secondGeometry = mergeGeometries(secondParts);
  for (const g of secondParts) g.dispose();
  const color = config.hands.second.color;
  const second = new THREE.Mesh(secondGeometry, color === 'match' ? steel : lib.lacquer(color));

  const cap = new THREE.Mesh(boss((refined ? 0.3 : 0.5) * k, refined ? 0.07 : 0.12), steel);

  const pivots = {
    hour: new THREE.Group(),
    minute: new THREE.Group(),
    second: new THREE.Group(),
  };
  pivots.hour.add(hour);
  pivots.minute.add(minute);
  pivots.second.add(second);
  // Gap exceeds the tallest facet (dauphine: 0.2*k) at every supported size.
  const levels = refined ? refinedHandLevels(k) : Z_LEVELS;
  hour.name = 'hour-blade';
  minute.name = 'minute-blade';
  second.name = 'second-blade';
  cap.name = 'pivot-cap';
  pivots.hour.position.z = levels.hour;
  pivots.minute.position.z = levels.minute;
  pivots.second.position.z = levels.second;
  cap.position.z = levels.cap;

  const group = new THREE.Group();
  group.name = 'hands';
  group.add(pivots.hour, pivots.minute, cap);
  const seconds = new THREE.Group();
  seconds.name = 'seconds';
  seconds.add(pivots.second);
  if (refined) group.scale.z = seconds.scale.z = Math.min(1, d.caseThickness / 11);

  return {
    group,
    seconds,
    setAngles(angles) {
      // Sens horaire vu de face (caméra sur +Z) = rotation négative autour de Z.
      pivots.hour.rotation.z = -angles.hour * DEG;
      pivots.minute.rotation.z = -angles.minute * DEG;
      pivots.second.rotation.z = -angles.second * DEG;
    },
  };
}

export const HAND_SETS = Object.keys(DESIGNS);
export const SECOND_STYLES = Object.keys(SECONDS);

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
    blade = beveledProfile(shape.samples, thickness, shape.ridge, set === 'leaf');
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
