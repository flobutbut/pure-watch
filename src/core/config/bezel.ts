import type { WatchConfig } from './types';

/** Available fixed profiles and the independent rotating ring. */
export const BEZEL_TYPES = [
  'smooth',
  'rounded',
  'stepped',
  'fluted',
  'coin',
  'notched',
  'rotating',
  'fixed-scale',
] as const;
export type BezelType = (typeof BEZEL_TYPES)[number];
export function effectiveBezelType(type: string): BezelType {
  return BEZEL_TYPES.includes(type as BezelType) ? (type as BezelType) : 'smooth';
}
export function bezelTypeForConfig(config: WatchConfig): BezelType {
  return effectiveBezelType(config.bezel.type);
}

/** A printed circular insert needs a circular glass seat, whether fixed or rotating. */
export function hasBezelInsert(config: WatchConfig): boolean {
  return config.bezel.type === 'rotating' || config.bezel.type === 'fixed-scale';
}

export function bezelScale(config: WatchConfig): 'dive-60' | '12h' | '24h' | 'tachymeter' {
  if (config.bezel.type === 'fixed-scale') {
    if (['dive-60', '12h', '24h'].includes(config.bezel.scale))
      return config.bezel.scale as 'dive-60' | '12h' | '24h';
    return 'tachymeter';
  }
  return config.bezel.scale === '12h' ? '12h' : config.bezel.scale === '24h' ? '24h' : 'dive-60';
}
/** 120 clicks per revolution; clockwise degrees, zero at twelve. */
export function bezelAngle(degrees: number): number {
  return Number.isFinite(degrees) ? (((Math.round(degrees / 3) * 3) % 360) + 360) % 360 : 0;
}
export function turnBezel(config: WatchConfig, delta: number): number {
  return bezelAngle(
    config.bezel.angleDeg + (bezelScale(config) === 'dive-60' ? Math.min(0, delta) : delta),
  );
}
