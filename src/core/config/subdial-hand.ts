import type { WatchConfig, HexColor } from './types';
import { smallSeconds } from './small-seconds';

export const SUBDIAL_HAND_STYLES = [
  'thin',
  'counterweight',
  'lollipop',
  'arrow',
  'triangle',
  'baton',
  'diamond',
  'teardrop',
  'ring-tail',
  'lightning',
  'none',
] as const;
export type SubdialHandStyle = (typeof SUBDIAL_HAND_STYLES)[number];

/** Old small-seconds links retain the hand formerly edited on the seconds row. */
export function subdialHand(config: WatchConfig, reserve = false) {
  const reserveSettings = config.details?.reserve;
  const hand = reserve
    ? {
        style: reserveSettings?.handStyle,
        color: reserveSettings?.handColor === 'auto' ? 'match' : reserveSettings?.handColor,
      }
    : config.details?.subdials?.hand;
  const original = !reserve && smallSeconds(config) ? config.hands.second : null;
  return {
    style: (hand?.style ?? original?.style ?? 'baton') as SubdialHandStyle,
    color: (hand?.color ?? original?.color ?? 'match') as HexColor | 'match',
  };
}
