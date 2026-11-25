/**
 * Anneau du cadran : une bande (ou un disque central) d'une autre matière ou couleur, posée
 * sur le fond. Rangé dans `details.ring` : absent, la montre et les anciens liens ne changent pas.
 */
import { effectiveDialColor } from './dial';
import type { WatchConfig } from './types';

export const RING_SHAPES = ['hours', 'outer', 'center'] as const;
export type RingShape = (typeof RING_SHAPES)[number];
export const RING_RELIEFS = ['flat', 'raised'] as const;
export type RingRelief = (typeof RING_RELIEFS)[number];

/** Diamètre extérieur et largeur, en part du rayon utile du cadran. */
export const RING_DIAMETER_RANGE = { min: 0.2, max: 1 } as const;
export const RING_WIDTH_RANGE = { min: 0.04, max: 1 } as const;

/** Formes types de la grille : le panneau règle ensuite diamètre et largeur. */
export const RING_PRESETS: Readonly<Record<RingShape, { diameter: number; width: number }>> = {
  // Sous les index : la bande qui porte les heures.
  hours: { diameter: 0.95, width: 0.26 },
  // Fine bande au bord, sous la minuterie.
  outer: { diameter: 1, width: 0.12 },
  // Disque central, façon cadran secteur.
  center: { diameter: 0.6, width: 1 },
};

/** Hauteur d'un anneau en relief (rapporté), en mm. */
export const RING_RAISED_HEIGHT = 0.15;

export interface DialRing {
  shape: RingShape;
  diameter: number;
  width: number;
  relief: RingRelief;
}

/** L'anneau porté par la montre, valeurs par défaut comprises ; null sans anneau. */
export function dialRing(config: WatchConfig): DialRing | null {
  const ring = config.details?.ring;
  if (!ring || !RING_SHAPES.includes(ring.shape)) return null;
  const preset = RING_PRESETS[ring.shape];
  return {
    shape: ring.shape,
    diameter: ring.diameter ?? preset.diameter,
    width: ring.width ?? preset.width,
    relief: ring.relief ?? 'flat',
  };
}

/** Rayons intérieur et extérieur, en mm (`dialRadius` : rayon utile du cadran). */
export function ringRadii(
  config: WatchConfig,
  dialRadius: number,
): { inner: number; outer: number; relief: RingRelief } | null {
  const ring = dialRing(config);
  if (!ring) return null;
  const outer = ring.diameter * dialRadius;
  return {
    outer,
    inner: Math.max(0, outer - ring.width * dialRadius),
    relief: ring.relief,
  };
}

/** Hauteur où repose ce qui est posé à `radius` du centre (index sur un anneau en relief). */
export function ringLift(config: WatchConfig, dialRadius: number, radius: number): number {
  const radii = ringRadii(config, dialRadius);
  if (!radii || radii.relief !== 'raised') return 0;
  return radius >= radii.inner && radius <= radii.outer ? RING_RAISED_HEIGHT : 0;
}

/**
 * Teinte « ton sur ton » : un cadran sombre reçoit un anneau éclairci, un cadran clair un
 * anneau assombri, pour que la bande se lise sans couleur choisie.
 */
export function ringToneColor(config: WatchConfig): string {
  const dial = effectiveDialColor(config.dial);
  const n = Number.parseInt(dial.slice(1, 7), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const [r, g, b] = channels as [number, number, number];
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const target = luminance > 0.5 ? 0 : 255;
  const amount = luminance > 0.5 ? 0.14 : 0.2;
  return `#${channels
    .map((c) =>
      Math.round(c + (target - c) * amount)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`;
}
