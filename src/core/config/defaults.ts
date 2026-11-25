import type { WatchConfig } from './types';
import { DEFAULT_REHAUT } from './rehaut';
import { DEFAULT_LUME } from './lume';
import { DEFAULT_HAND_LAYOUT } from './hands';
import { DEFAULT_BEZEL_LAYOUT } from './bezel';

/** Montre de départ : ronde, acier, 40 mm, cadran noir mat, aiguilles épée. */
export const DEFAULT_CONFIG: Readonly<WatchConfig> = Object.freeze({
  schema: 1,
  style: null,
  movement: 'nh35',
  case: {
    shape: 'round',
    profile: 'curved',
    diameterMm: 40,
    thicknessMm: 11,
    lugToLugMm: 47,
    lugWidthMm: 20,
    lugs: 'straight',
    lugJoin: 'detached',
    material: 'steel',
    finish: 'mixed',
    caseback: 'solid',
  },
  crown: { style: 'onion', position: '3h', guard: false, screwed: true },
  bezel: {
    ...DEFAULT_BEZEL_LAYOUT,
    type: 'smooth',
    insert: 'none',
    scale: 'none',
    color: '#101418',
    pip: 'none',
    angleDeg: 0,
  },
  crystal: { type: 'sapphire-domed', coating: 'none', cyclops: false },
  rehaut: { ...DEFAULT_REHAUT },
  dial: {
    size: 'open',
    shape: 'round',
    material: 'metal',
    finish: 'matte',
    color: '#111317',
    pattern: null,
    chapterRing: 'railroad',
    chapterRingColor: 'match',
    indices: {
      style: 'baton',
      finish: 'applied-polished',
      lume: null,
      color: '#E8EBF0',
      ...DEFAULT_LUME,
      numerals: 'none',
      numeralSystem: 'arabic',
      numeralFont: 'sans',
      numeralSize: 1,
      numeralRadius: 1,
      numeralColor: 'match',
      indexLength: 1,
      indexWidth: 1,
      indexRadius: 1,
    },
    text: { brand: '', line2: '', position: '12h' },
  },
  hands: {
    ...DEFAULT_HAND_LAYOUT,
    set: 'sword',
    finish: 'polished',
    color: '#E8EBF0',
    lume: null,
    ...DEFAULT_LUME,
    second: { style: 'counterweight', color: '#F0561D', counterweight: true },
  },
  complications: [],
  strap: {
    type: 'leather',
    material: 'calf-grained',
    color: '#5A3A22',
    stitching: '#C8B08A',
    widthMm: 20,
    buckle: 'tang',
  },
  view: { time: 'live', lighting: 'studio', night: false },
} satisfies WatchConfig);

/** Copie modifiable de la configuration par défaut. */
export function defaultConfig(): WatchConfig {
  return structuredClone(DEFAULT_CONFIG) as WatchConfig;
}
