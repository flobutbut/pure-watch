/**
 * Couleur réellement visible d'un cadran. Certaines matières ont leur propre teinte
 * (nacre, film d'huile) : la ligne Couleur ne s'y applique pas et disparaît de la grille.
 * La couleur choisie reste mémorisée pour le retour à une finition colorable.
 */
import type { DialConfig, WatchConfig } from './types';

/** Retired finish: old links become a sunburst dial with an independent fumé effect. */
export function normalizeDialFinish(config: WatchConfig): WatchConfig {
  if (config.dial.finish !== 'fume') return config;
  return {
    ...config,
    dial: { ...config.dial, finish: 'sunburst' },
    details: {
      ...config.details,
      dial: {
        ...config.details?.dial,
        fume: config.details?.dial?.fume ?? 1,
        legacyFume: true,
      },
    },
  };
}

export const INTRINSIC_DIAL_COLORS: Readonly<Record<string, string>> = {
  'iridescent-pearl': '#E9E4DC',
  'iridescent-oil': '#2B2F3A',
};

export function hasIntrinsicColor(finish: string): boolean {
  return finish in INTRINSIC_DIAL_COLORS;
}

/** Encre lisible sur la couleur de cadran : foncée sur cadran clair, claire sur cadran foncé. */
export function printInk(hex: string): string {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.55 ? '#1B1F27' : '#F2F1EC';
}

/** Couleur de la piste des minutes : l'encre du cadran, sauf teinte choisie. */
export function chapterRingColor(dial: DialConfig): string {
  return dial.chapterRingColor === 'match'
    ? printInk(effectiveDialColor(dial))
    : dial.chapterRingColor;
}

/** Couleur des chiffres des heures : l'encre du cadran, sauf teinte choisie. */
export function numeralColor(dial: DialConfig): string {
  const color = dial.indices.numeralColor;
  return color === 'match' ? printInk(effectiveDialColor(dial)) : color;
}

export function effectiveDialColor(dial: { finish: DialConfig['finish']; color: string }): string {
  return INTRINSIC_DIAL_COLORS[dial.finish] ?? dial.color;
}
