import type { WatchConfig } from './types';

/** Family refined in the second pilot: the user's black ceramic tonneau. */
export function isBlackTonneau(config: WatchConfig): boolean {
  return config.case.shape === 'tonneau' && config.case.material === 'ceramic';
}
