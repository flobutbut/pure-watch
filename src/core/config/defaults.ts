import type { WatchConfig } from './types';

/** Montre de départ : ronde, acier, 40 mm, cadran noir mat, aiguilles épée. */
export const DEFAULT_CONFIG: Readonly<WatchConfig> = Object.freeze({
  schema: 1,
  style: null,
  movement: 'nh35',
  case: {
    shape: 'round',
    diameterMm: 40,
    thicknessMm: 11,
    lugToLugMm: 47,
    lugWidthMm: 20,
    lugs: 'straight',
    material: 'steel',
    finish: 'mixed',
    caseback: 'solid',
  },
  crown: { style: 'onion', position: '3h', guard: false, screwed: true },
  bezel: { type: 'smooth', insert: 'none', scale: 'none', color: '#101418', pip: 'none' },
  crystal: { type: 'sapphire-domed', coating: 'none', cyclops: false },
  dial: {
    shape: 'round',
    material: 'metal',
    finish: 'matte',
    color: '#111317',
    pattern: null,
    chapterRing: 'railroad',
    indices: {
      style: 'baton',
      finish: 'applied-polished',
      lume: null,
      numerals: 'none',
      numeralFont: 'sans',
    },
    text: { brand: '', line2: '', position: '12h' },
  },
  hands: {
    set: 'sword',
    finish: 'polished',
    color: '#E8EBF0',
    lume: null,
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
