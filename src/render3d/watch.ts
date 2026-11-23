/**
 * Assemblage d'une montre complète à partir d'une configuration. Chaque pièce est rangée
 * dans un calque nommé : les instantanés de cellule n'affichent que les calques de leur
 * ligne (règle R1 : une cellule ne montre que sa pièce).
 */
import * as THREE from 'three';
import type { HandAngles } from '../core/clock/angles';
import { isBlackTonneau } from '../core/config/instrument';
import type { WatchConfig } from '../core/config/types';
import { watchDimensions, type WatchDimensions } from '../core/geometry/dimensions';
import type { CrystalQuality, MaterialLibrary } from './materials';
import type { Refinement } from './refinement';
import { buildCushionCase } from './parts/cushion-case';
import { buildCase } from './parts/case';
import { buildCrown } from './parts/crown';
import { buildCrystal } from './parts/crystal';
import { buildDial } from './parts/dial';
import { buildHands } from './parts/hands';
import { buildLugs } from './parts/lugs';
import { decorateRehaut } from './parts/rehaut';
import { buildRotatingBezel } from './parts/rotating-bezel';

export const LAYERS = [
  'case',
  'rehaut',
  'lugs',
  'crown',
  'dial',
  'print',
  'indices',
  'hands',
  'seconds',
  'crystal',
] as const;
export type Layer = (typeof LAYERS)[number];

export interface WatchModel {
  root: THREE.Group;
  layers: Record<Layer, THREE.Object3D>;
  dimensions: WatchDimensions;
  /** Résolue quand toutes les textures sont prêtes (à attendre avant un instantané). */
  ready: Promise<void>;
  setAngles(angles: HandAngles): void;
  setBezelAngle(angle: number): void;
  /** N'affiche que certains calques (null = tous). */
  showOnly(layers: readonly Layer[] | null): void;
  dispose(): void;
}

export interface BuildOptions {
  quality: CrystalQuality;
  refinement?: Refinement;
  /** Independent hand comparison, with case and lighting kept identical. */
  handDetail?: 'legacy' | 'refined';
  /** Ne construire que ces calques (instantanés) ; null = montre complète. */
  layers?: readonly Layer[] | null;
  /** Résolution de la texture d'impression du cadran. */
  printSize?: number;
}

const empty = (name: string) => Object.assign(new THREE.Group(), { name });

export function buildWatch(
  config: WatchConfig,
  lib: MaterialLibrary,
  options: BuildOptions,
): WatchModel {
  const d = watchDimensions(config);
  const refined = config.case.shape === 'cushion' && options.refinement !== 'legacy';
  const instrument = isBlackTonneau(config) && options.refinement !== 'legacy';
  const wanted = (layer: Layer) => !options.layers || options.layers.includes(layer);
  const caseParts =
    wanted('case') || wanted('rehaut')
      ? refined
        ? buildCushionCase(config, d, lib)
        : buildCase(config, d, lib, instrument)
      : null;
  const dialParts =
    wanted('dial') || wanted('print') || wanted('indices')
      ? buildDial(config, d, lib, { print: wanted('print'), printSize: options.printSize ?? 2048 })
      : null;
  const rotatingBezel =
    config.bezel.type === 'rotating' && caseParts && wanted('case')
      ? buildRotatingBezel(config, d, lib, options.printSize)
      : null;
  if (rotatingBezel) caseParts!.case.add(rotatingBezel.group);
  const detailedHands = options.handDetail
    ? options.handDetail === 'refined'
    : options.refinement !== 'legacy';
  const hands = buildHands(
    config,
    d,
    lib,
    refined || instrument || detailedHands,
    instrument,
    detailedHands,
  );

  const layers: Record<Layer, THREE.Object3D> = {
    case: caseParts && wanted('case') ? caseParts.case : empty('case'),
    rehaut: caseParts && wanted('rehaut') ? caseParts.rehaut : empty('rehaut'),
    lugs: wanted('lugs') ? buildLugs(config, d, lib, refined) : empty('lugs'),
    crown: wanted('crown') ? buildCrown(config, d, lib, refined) : empty('crown'),
    dial: dialParts?.dial ?? empty('dial'),
    print: dialParts?.print ?? empty('print'),
    indices: dialParts && wanted('indices') ? dialParts.indices : empty('indices'),
    hands: wanted('hands') ? hands.group : empty('hands'),
    seconds: wanted('seconds') ? hands.seconds : empty('seconds'),
    crystal: wanted('crystal')
      ? buildCrystal(config, d, lib, options.quality, refined || d.dialShape !== 'round')
      : empty('crystal'),
  };

  // Pièces construites mais non retenues : libérées tout de suite.
  const discarded = [
    !wanted('hands') && hands.group,
    !wanted('seconds') && hands.seconds,
    caseParts && !wanted('case') && caseParts.case,
    caseParts && !wanted('rehaut') && caseParts.rehaut,
    dialParts && !wanted('indices') && dialParts.indices,
  ];
  for (const object of discarded) if (object) disposeGeometries(object);

  const root = new THREE.Group();
  const rehautPrint = wanted('rehaut')
    ? decorateRehaut(layers.rehaut, config, d, options.printSize)
    : null;
  root.name = 'watch';
  for (const layer of LAYERS) root.add(layers[layer]);

  return {
    root,
    layers,
    dimensions: d,
    ready: Promise.all([dialParts?.ready, rehautPrint?.ready, rotatingBezel?.ready]).then(() => {}),
    setAngles: hands.setAngles,
    setBezelAngle: (angle) => rotatingBezel?.setAngle(angle),
    showOnly(visible) {
      for (const layer of LAYERS) layers[layer].visible = !visible || visible.includes(layer);
    },
    dispose() {
      // Les matériaux partagés appartiennent à la bibliothèque ; on ne libère ici que
      // les géométries et les ressources propres à cette montre.
      disposeGeometries(root);
      for (const resource of dialParts?.owned ?? []) resource.dispose();
      for (const resource of rehautPrint?.owned ?? []) resource.dispose();
      for (const resource of rotatingBezel?.owned ?? []) resource.dispose();
      root.removeFromParent();
    },
  };
}

function disposeGeometries(object: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) geometries.add(child.geometry);
  });
  for (const g of geometries) g.dispose();
}
