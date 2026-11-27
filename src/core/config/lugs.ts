import type { WatchConfig } from './types';

export const LUG_JOINS = ['detached', 'flush', 'blended'] as const;
export type LugJoin = (typeof LUG_JOINS)[number];
/** The legacy flush connection remains readable without adding a third UI choice. */
export const LUG_CONNECTIONS = ['detached', 'blended'] as const;
export function lugJoin(config: WatchConfig): LugJoin {
  return LUG_JOINS.includes(config.case.lugJoin as LugJoin)
    ? (config.case.lugJoin as LugJoin)
    : 'detached';
}
export function continuousLugs(config: WatchConfig): boolean {
  return config.case.lugs !== 'none' && lugJoin(config) !== 'detached';
}
