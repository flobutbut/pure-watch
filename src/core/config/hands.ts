import type { HandAdjustment, HandsConfig } from './types';

export const HAND_STYLES = [
  'baton',
  'dauphine',
  'sword',
  'leaf',
  'breguet',
  'syringe',
  'spear',
  'pencil',
  'spade',
  'art-deco',
  'skeleton',
  'cathedral',
  'mercedes',
] as const;
export const DEFAULT_HAND: HandAdjustment = { style: 'match', length: 1, width: 1 };
export const DEFAULT_HAND_LAYOUT = { hour: { ...DEFAULT_HAND }, minute: { ...DEFAULT_HAND } };
export type HandLayout = typeof DEFAULT_HAND_LAYOUT;
export const HAND_LENGTH = { hour: { min: 0.65, max: 1.35 }, minute: { min: 0.65, max: 1.05 } };
export const HAND_WIDTH = { min: 0.6, max: 1.8 };
const bounded = (n: number, lo: number, hi: number) =>
  Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : 1;
export function handAdjustment(hands: HandsConfig, part: 'hour' | 'minute'): HandAdjustment {
  const value = hands[part] ?? DEFAULT_HAND;
  return {
    style:
      value.style === 'match' || HAND_STYLES.some((s) => s === value.style) ? value.style : 'match',
    length: bounded(value.length, HAND_LENGTH[part].min, HAND_LENGTH[part].max),
    width: bounded(value.width, HAND_WIDTH.min, HAND_WIDTH.max),
  };
}
export function handStyle(hands: HandsConfig, part: 'hour' | 'minute'): string {
  const value = handAdjustment(hands, part);
  return value.style === 'match' ? hands.set : value.style;
}
