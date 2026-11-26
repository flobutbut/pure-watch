import type { DialConfig, WatchConfig } from './types';

export type NumeralSystem = 'arabic' | 'roman';
export type HourMarker = 'numeral' | 'index' | 'none';
export type HourMarkers = Record<string, HourMarker>;

const NUMERAL_HOURS: Readonly<Record<string, readonly number[]>> = {
  all: Array.from({ length: 12 }, (_, h) => h),
  roman: Array.from({ length: 12 }, (_, h) => h),
  cardinal: [0, 3, 6, 9],
  explorer: [3, 6, 9],
  twelve: [0],
  'six-twelve': [0, 6],
  even: [0, 2, 4, 6, 8, 10],
};

/** Hours use 0 for noon internally; saved exceptions use 12. */
export function numeralHours(set: string | undefined, overrides?: HourMarkers): number[] {
  const key = set ?? 'none';
  const hours = Object.hasOwn(NUMERAL_HOURS, key) ? NUMERAL_HOURS[key]! : [];
  if (!overrides || !Object.keys(overrides).length) return [...hours];
  return Array.from({ length: 12 }, (_, h) => h).filter((h) => {
    const override = overrides[String(h || 12)];
    return override ? override === 'numeral' : hours.includes(h);
  });
}

export function hourMarkerAt(config: WatchConfig, hour: number): HourMarker {
  const key = String(hour || 12);
  const override = config.details?.hourMarkers?.[key];
  if (override) return override;
  if (numeralHours(config.dial.indices.numerals).includes(hour)) return 'numeral';
  const style = config.details?.indices?.[key]?.style ?? config.dial.indices.style;
  return style === 'none' ? 'none' : 'index';
}

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
