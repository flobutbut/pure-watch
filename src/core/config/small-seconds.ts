/**
 * Petite seconde (spec §5.10) : sous-cadran où tourne la trotteuse, qui quitte le centre.
 * Elle vit dans `config.complications` sous la forme
 * `{ type: 'small-seconds', position, style }`.
 *
 * Coordonnées normalisées par le rayon du cadran (spec §8.3), repère 3D : +X vers 3 h,
 * +Y vers 12 h.
 */
import { getAtPath } from './path';
import type { WatchConfig } from './types';
import { subdialStyle, type SubdialStyle } from './subdial-style';
export type { SubdialStyle } from './subdial-style';

export interface SmallSeconds {
  position: string;
  style: SubdialStyle;
}

/** Centre du sous-cadran, en fraction du rayon (§8.3). */
// Dans l'ordre de préférence quand une autre complication prend la place.
export const SMALL_SECONDS_POSITIONS: Readonly<Record<string, readonly [number, number]>> = {
  '6h': [0, -0.5],
  '9h': [-0.5, 0],
  '3h': [0.5, 0],
  '12h': [0, 0.5],
};

/** Rayon du sous-cadran en fraction du rayon du cadran (§8.3). */
export const SUBDIAL_RADIUS = 0.28;

export function smallSeconds(config: WatchConfig): SmallSeconds | null {
  const raw = getAtPath(config, 'complications.small-seconds') as Record<string, unknown> | null;
  if (!raw || typeof raw['position'] !== 'string' || !(raw['position'] in SMALL_SECONDS_POSITIONS))
    return null;
  const style = subdialStyle(config);
  return { position: raw['position'], style };
}

/** Centre et rayon du sous-cadran en mm, pour un cadran de rayon `radius`. */
export function subdialCircle(config: WatchConfig, radius: number) {
  const seconds = smallSeconds(config);
  if (!seconds) return null;
  const [x, y] = SMALL_SECONDS_POSITIONS[seconds.position]!;
  return { x: x * radius, y: y * radius, r: SUBDIAL_RADIUS * radius, style: seconds.style };
}
