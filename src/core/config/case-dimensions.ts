import { shapeRadius } from '../geometry/case-shape';
import { contourExtents } from '../geometry/dial-shape';
import type { Locale } from '../i18n/locale';
import { MESSAGES } from '../i18n/messages';
import type { WatchConfig } from './types';

export const CASE_DIMENSIONS = [
  { key: 'diameterMm', label: 'Diamètre', min: 22, max: 48, step: 0.1 },
  { key: 'thicknessMm', label: 'Épaisseur', min: 3, max: 25, step: 0.1 },
  { key: 'lugToLugMm', label: 'Longueur de corne à corne', min: 22, max: 75, step: 0.1 },
  { key: 'lugWidthMm', label: 'Entre-cornes / bracelet', min: 10, max: 30, step: 0.1 },
] as const;

export type CaseDimensions = Pick<WatchConfig['case'], (typeof CASE_DIMENSIONS)[number]['key']>;

/** Strap widths sold as standard: the lug-width slider settles on them. */
export const STRAP_WIDTHS_MM = [10, 12, 14, 16, 17, 18, 19, 20, 21, 22, 24, 26, 28, 30] as const;

/**
 * Magnetic stops of a slider: the value settles on the nearest one within `tolerance`
 * (same unit as the value), otherwise it stays where the pointer left it.
 */
export function snapToStops(value: number, stops: readonly number[], tolerance: number): number {
  let best = value;
  let distance = tolerance;
  for (const stop of stops) {
    const gap = Math.abs(stop - value);
    if (gap <= distance) {
      best = stop;
      distance = gap;
    }
  }
  return best;
}

export function caseDimensions(config: WatchConfig): CaseDimensions {
  const { diameterMm, thicknessMm, lugToLugMm, lugWidthMm } = config.case;
  return { diameterMm, thicknessMm, lugToLugMm, lugWidthMm };
}

/** Reject invalid drafts before they reach the geometry or the shared link. */
export function caseDimensionsError(
  config: WatchConfig,
  values: CaseDimensions,
  locale: Locale = 'fr',
): string {
  const m = MESSAGES[locale].dimensions;
  for (const field of CASE_DIMENSIONS) {
    const value = values[field.key];
    if (!Number.isFinite(value) || value < field.min || value > field.max)
      return m.range(m[field.key], field.min, field.max);
  }
  const width = values.diameterMm * contourExtents(config.case.shape).min;
  if (
    values.lugWidthMm > width - 3 &&
    (values.lugWidthMm !== config.case.lugWidthMm || values.diameterMm !== config.case.diameterMm)
  )
    return m.lugWidthTooWide;
  const height = values.diameterMm * shapeRadius(config.case.shape, Math.PI / 2);
  if (
    config.case.lugs !== 'none' &&
    values.lugToLugMm < height &&
    (values.lugToLugMm !== config.case.lugToLugMm || values.diameterMm !== config.case.diameterMm)
  )
    return m.lugToLugTooShort;
  return '';
}

export function withCaseDimensions(config: WatchConfig, values: CaseDimensions): WatchConfig {
  if (caseDimensionsError(config, values)) return config;
  return {
    ...config,
    case: { ...config.case, ...values },
    strap:
      values.lugWidthMm === config.case.lugWidthMm
        ? config.strap
        : { ...config.strap, widthMm: values.lugWidthMm },
  };
}
