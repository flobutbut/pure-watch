/**
 * Anneau du cadran : une bande (ou un disque central) d'une autre matière ou couleur, posée
 * sur le fond. Rangé dans `details.ring` : absent, la montre et les anciens liens ne changent pas.
 */
import { effectiveDialColor } from './dial';
import type { WatchConfig } from './types';

/** Un seul anneau ; les trois formes d'avant restent lisibles dans les anciens liens. */
export const RING_SHAPE = 'ring';
export const LEGACY_RING_SHAPES = ['hours', 'outer', 'center'] as const;
export const RING_SHAPES = [RING_SHAPE, ...LEGACY_RING_SHAPES] as const;
export const RING_RELIEFS = ['flat', 'raised'] as const;
export type RingRelief = (typeof RING_RELIEFS)[number];

/**
 * Bords de l'anneau, en part du rayon utile du cadran : 0, le centre (un disque plein) ;
 * 1, le bord du cadran, sous le rehaut.
 */
export const RING_EDGE_RANGE = { min: 0, max: 1 } as const;
/** Épaisseur minimale : un cercle fin, à peine plus large qu'un trait. */
export const RING_MIN_WIDTH = 0.01;
/** Anneau ajouté depuis la grille : la bande qui porte les heures. */
export const RING_DEFAULT = { inner: 0.69, outer: 0.95 } as const;

/** Anciennes formes : diamètre extérieur et largeur, en part du rayon utile. */
const LEGACY_PRESETS: Readonly<
  Record<(typeof LEGACY_RING_SHAPES)[number], { diameter: number; width: number }>
> = {
  hours: { diameter: 0.95, width: 0.26 },
  outer: { diameter: 1, width: 0.12 },
  center: { diameter: 0.6, width: 1 },
};

const round = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Bords d'un anneau d'un ancien lien (forme, diamètre, largeur) : la montre reste la même.
 * Une largeur plus grande que le diamètre donnait un disque plein.
 */
export function legacyRingEdges(
  shape: (typeof LEGACY_RING_SHAPES)[number],
  diameter?: number,
  width?: number,
): { inner: number; outer: number } {
  const preset = LEGACY_PRESETS[shape];
  const outer = diameter ?? preset.diameter;
  return { inner: round(Math.max(0, outer - (width ?? preset.width))), outer };
}

/** Hauteur d'un anneau en relief (rapporté), en mm. */
export const RING_RAISED_HEIGHT = 0.15;

export interface DialRing {
  inner: number;
  outer: number;
  relief: RingRelief;
}

/** L'anneau porté par la montre, valeurs par défaut comprises ; null sans anneau. */
export function dialRing(config: WatchConfig): DialRing | null {
  const ring = config.details?.ring;
  if (!ring || ring.shape !== RING_SHAPE) return null;
  return {
    ...fitRingEdges({
      inner: ring.inner ?? RING_DEFAULT.inner,
      outer: ring.outer ?? RING_DEFAULT.outer,
    }),
    relief: ring.relief ?? 'flat',
  };
}

/** Bords ramenés dans le cadran, l'anneau gardant au moins son épaisseur minimale. */
function fitRingEdges({ inner, outer }: { inner: number; outer: number }) {
  const o = Math.min(RING_EDGE_RANGE.max, Math.max(RING_MIN_WIDTH, outer));
  return { inner: Math.max(RING_EDGE_RANGE.min, Math.min(inner, o - RING_MIN_WIDTH)), outer: o };
}

export type RingSlider = 'inner' | 'position' | 'outer';

/** Bornes d'un curseur du panneau, selon l'anneau en cours. */
export function ringSliderRange(ring: DialRing, slider: RingSlider): { min: number; max: number } {
  if (slider === 'inner')
    return { min: RING_EDGE_RANGE.min, max: RING_EDGE_RANGE.max - RING_MIN_WIDTH };
  if (slider === 'outer')
    return { min: RING_EDGE_RANGE.min + RING_MIN_WIDTH, max: RING_EDGE_RANGE.max };
  const half = (ring.outer - ring.inner) / 2;
  return { min: RING_EDGE_RANGE.min + half, max: RING_EDGE_RANGE.max - half };
}

/** Valeur d'un curseur : un bord, ou le milieu de la bande pour la position. */
export function ringSliderValue(ring: DialRing, slider: RingSlider): number {
  return slider === 'position' ? (ring.inner + ring.outer) / 2 : ring[slider];
}

/**
 * Nouveaux bords après un curseur. Un bord qui rattrape l'autre le pousse ; la position
 * déplace la bande entière sans changer son épaisseur.
 */
export function moveRing(
  ring: DialRing,
  slider: RingSlider,
  value: number,
): { inner: number; outer: number } {
  const { min, max } = ringSliderRange(ring, slider);
  const v = Math.min(max, Math.max(min, value));
  if (slider === 'inner')
    return { inner: round(v), outer: round(Math.max(ring.outer, v + RING_MIN_WIDTH)) };
  if (slider === 'outer')
    return { inner: round(Math.min(ring.inner, v - RING_MIN_WIDTH)), outer: round(v) };
  const half = (ring.outer - ring.inner) / 2;
  return { inner: round(v - half), outer: round(v + half) };
}

/** Rayons intérieur et extérieur, en mm (`dialRadius` : rayon utile du cadran). */
export function ringRadii(
  config: WatchConfig,
  dialRadius: number,
): { inner: number; outer: number; relief: RingRelief } | null {
  const ring = dialRing(config);
  if (!ring) return null;
  return {
    outer: ring.outer * dialRadius,
    inner: ring.inner * dialRadius,
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
