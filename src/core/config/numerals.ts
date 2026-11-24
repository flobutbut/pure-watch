import type { DialConfig, WatchConfig } from './types';

export type NumeralSystem = 'arabic' | 'roman';

/** `numerals: roman` remains readable as the historical full Roman dial. */
export function numeralSystem(
  indices: Pick<DialConfig['indices'], 'numerals' | 'numeralSystem'>,
): NumeralSystem {
  return indices.numerals === 'roman' || indices.numeralSystem === 'roman' ? 'roman' : 'arabic';
}

export function normalizeNumerals(config: WatchConfig): WatchConfig {
  if (config.dial.indices.numerals !== 'roman') return config;
  return {
    ...config,
    dial: {
      ...config.dial,
      indices: { ...config.dial.indices, numerals: 'all', numeralSystem: 'roman' },
    },
  };
}
