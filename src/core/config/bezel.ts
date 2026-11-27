import type { WatchConfig } from './types';
import { shapeRadius } from '../geometry/case-shape';

export const DEFAULT_BEZEL_LAYOUT = { shape: 'case', width: 1, height: 1, finish: 'case' };
export const BEZEL_SHAPES = [
  'case',
  'round',
  'cushion',
  'octagon',
  'square',
  'rectangle',
  'tonneau',
] as const;
export const BEZEL_FINISHES = [
  'case',
  'mixed',
  'polished',
  'brushed',
  'sandblasted',
  'pvd-black',
] as const;
export type BezelLayout = typeof DEFAULT_BEZEL_LAYOUT;
export function bezelLayout(config: WatchConfig): BezelLayout {
  const b = config.bezel;
  const bounded = (v: number, lo: number, hi: number) =>
    Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 1;
  return {
    shape: BEZEL_SHAPES.some((s) => s === b.shape) ? b.shape : 'case',
    finish: BEZEL_FINISHES.some((s) => s === b.finish) ? b.finish : 'case',
    width: bounded(b.width, 0.7, 1.8),
    height: bounded(b.height, 1, 1.6),
  };
}
export function independentBezel(config: WatchConfig): boolean {
  // Every fixed bezel is a separate part. Its seat and dimensions must not depend
  // on whether the midcase has detached lugs, integrated lugs or crown guards.
  return !hasBezelInsert(config);
}
export function bezelShape(config: WatchConfig): string {
  const b = bezelLayout(config);
  return hasBezelInsert(config) ? 'round' : b.shape === 'case' ? config.case.shape : b.shape;
}
export function bezelMetalConfig(config: WatchConfig): WatchConfig {
  const { finish } = bezelLayout(config);
  return finish === 'case' ? config : { ...config, case: { ...config.case, finish } };
}
const envelopes = new Map<string, number>();
/** Largest centred bezel that stays on the case shoulder at every angle. */
export function bezelEnvelopeRadius(config: WatchConfig, radius: number): number {
  if (!independentBezel(config) || bezelShape(config) === config.case.shape) return radius;
  const shape = bezelShape(config),
    key = `${config.case.shape}:${shape}:${radius}`;
  const cached = envelopes.get(key);
  if (cached !== undefined) return cached;
  let result = Infinity;
  for (let i = 0; i < 1024; i++) {
    const angle = (i * Math.PI * 2) / 1024;
    result = Math.min(
      result,
      (radius * shapeRadius(config.case.shape, angle) - 0.1) / shapeRadius(shape, angle),
    );
  }
  result *= 0.998;
  if (envelopes.size >= 128) envelopes.delete(envelopes.keys().next().value!);
  envelopes.set(key, result);
  return result;
}

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
