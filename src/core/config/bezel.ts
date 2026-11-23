import type { WatchConfig } from './types';
import { effectiveDialShape } from '../geometry/dial-shape';

/** Fixed bezel profiles currently available in the catalog. */
export const BEZEL_TYPES = ['smooth', 'rounded', 'stepped', 'fluted', 'coin', 'notched'] as const;
export type BezelType = (typeof BEZEL_TYPES)[number];
export function effectiveBezelType(type: string): BezelType {
  return BEZEL_TYPES.includes(type as BezelType) ? (type as BezelType) : 'smooth';
}
/** The legacy round aperture protrudes from the narrow rectangular case. */
export function canMachineBezel(config: WatchConfig): boolean {
  return !(config.case.shape === 'rectangle' && effectiveDialShape(config.dial.shape) === 'round');
}

export function bezelTypeForConfig(config: WatchConfig): BezelType {
  return canMachineBezel(config) ? effectiveBezelType(config.bezel.type) : 'smooth';
}
