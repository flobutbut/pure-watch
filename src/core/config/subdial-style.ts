import type { WatchConfig } from './types';
import { getAtPath } from './path';

export const SUBDIAL_STYLES = ['flat', 'sunken'] as const;
export type SubdialStyle = (typeof SUBDIAL_STYLES)[number];

/** Shared construction styles; absent choices preserve each historical appearance. */
export function subdialStyle(
  config: WatchConfig,
  target: 'subdials' | 'reserve' = 'subdials',
): SubdialStyle {
  const explicit: string | undefined = config.details?.[target]?.subdialStyle;
  if (explicit === 'rail') return 'flat'; // Old graphic option is no longer a construction style.
  if (SUBDIAL_STYLES.some((style) => style === explicit)) return explicit as SubdialStyle;
  if (target === 'reserve') return 'flat';
  const original = getAtPath(config, 'complications.small-seconds.style');
  if (SUBDIAL_STYLES.some((style) => style === original)) return original as SubdialStyle;
  return 'flat';
}
