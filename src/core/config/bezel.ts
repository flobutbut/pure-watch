import type { WatchConfig } from './types';

/** Fixed bezel profiles currently available in the catalog. */
export const BEZEL_TYPES = ['smooth', 'rounded', 'stepped', 'fluted', 'coin', 'notched'] as const;
export type BezelType = (typeof BEZEL_TYPES)[number];
export function effectiveBezelType(type: string): BezelType {
  return BEZEL_TYPES.includes(type as BezelType) ? (type as BezelType) : 'smooth';
}
export function bezelTypeForConfig(config: WatchConfig): BezelType {
  return effectiveBezelType(config.bezel.type);
}
