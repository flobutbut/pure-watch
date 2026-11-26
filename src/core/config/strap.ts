import type { StrapConfig, WatchConfig } from './types';
import { clamp } from '../geometry/dimensions';

export const STRAP_TYPES = ['metal', 'rubber', 'leather', 'fabric'] as const;
export type StrapType = (typeof STRAP_TYPES)[number];
export const STRAP_STYLES = {
  metal: ['three-link', 'five-link', 'mesh'],
  rubber: ['smooth', 'ribbed', 'rally'],
  leather: ['grained', 'smooth', 'rally'],
  fabric: ['woven', 'ribbed', 'striped'],
} as const;
export const BUCKLE_FINISHES = ['case', 'steel', 'gold-yellow', 'gold-rose', 'black'] as const;
export const STRAP_LENGTHS = { short: [65, 105], standard: [75, 115], long: [85, 125] } as const;
export type StrapLength = keyof typeof STRAP_LENGTHS;

/** Legacy straps remain readable; omitted settings have stable defaults. */
export function strapSettings(config: WatchConfig): StrapConfig {
  const raw = config.strap;
  const type: StrapType = STRAP_TYPES.includes(raw.type as StrapType)
    ? (raw.type as StrapType)
    : 'leather';
  const styles: readonly string[] = STRAP_STYLES[type];
  return {
    ...raw,
    type,
    material: styles.includes(raw.material) ? raw.material : styles[0]!,
    widthMm: config.case.lugWidthMm,
    length: raw.length && raw.length in STRAP_LENGTHS ? raw.length : 'standard',
    taperMm: clamp(raw.taperMm ?? 4, 0, Math.min(6, config.case.lugWidthMm - 8)),
    buckle: raw.buckle === 'deployant' || type === 'metal' ? 'deployant' : 'tang',
    buckleFinish: BUCKLE_FINISHES.includes(raw.buckleFinish ?? 'case')
      ? (raw.buckleFinish ?? 'case')
      : 'case',
  };
}

export function withStrapType(config: WatchConfig, type: StrapType): WatchConfig {
  const color = { metal: '#C9CED6', rubber: '#222A30', leather: '#5A3A22', fabric: '#586354' }[
    type
  ];
  return {
    ...config,
    strap: {
      ...strapSettings(config),
      type,
      material: STRAP_STYLES[type][0],
      color: color as `#${string}`,
      buckle: type === 'metal' ? 'deployant' : 'tang',
    },
  };
}
