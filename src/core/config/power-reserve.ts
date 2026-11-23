/**
 * Réserve de marche (spec §5.10) : éventail gradué où une aiguille indique l'énergie
 * restante. Elle vit dans `config.complications` sous la forme
 * `{ type: 'power-reserve', position, style }`.
 *
 * Coordonnées normalisées par le rayon du cadran (spec §8.3 : arc de 90°, rayon 0,32),
 * repère 3D : +X vers 3 h, +Y vers 12 h. L'éventail s'ouvre toujours vers 12 h : vide à
 * gauche, plein à droite.
 */
import { getAtPath } from './path';
import type { WatchConfig } from './types';

export type ReserveStyle = 'arc' | 'segments' | 'fuel';

export interface PowerReserve {
  position: string;
  style: ReserveStyle;
}

/** Centre de l'éventail (et non son pivot), en fraction du rayon ; ordre de préférence. */
export const POWER_RESERVE_POSITIONS: Readonly<Record<string, readonly [number, number]>> = {
  '9h': [-0.5, 0],
  '3h': [0.5, 0],
  '6h': [0, -0.5],
  '12h': [0, 0.5],
};

/** Éventail : rayon et demi-ouverture (spec §8.3 : 90° ; un peu plus pour la lisibilité). */
export const RESERVE_RADIUS = 0.3;
export const RESERVE_HALF_ANGLE = 50;

/**
 * Énergie montrée : la montre a été portée récemment, il lui reste environ 30 h sur
 * les 41 h d'un NH35 (valeur figée, la vue 3D ne simule pas le remontage).
 */
export const RESERVE_LEVEL = 0.72;

const STYLES: readonly ReserveStyle[] = ['arc', 'segments', 'fuel'];

export function powerReserve(config: WatchConfig): PowerReserve | null {
  const raw = getAtPath(config, 'complications.power-reserve') as Record<string, unknown> | null;
  if (!raw || typeof raw['position'] !== 'string' || !(raw['position'] in POWER_RESERVE_POSITIONS))
    return null;
  return { position: raw['position'], style: STYLES.find((s) => s === raw['style']) ?? 'arc' };
}

/** Pivot de l'aiguille, rayon de l'éventail (mm) et style, pour un cadran de rayon `radius`. */
export function reserveGauge(config: WatchConfig, radius: number) {
  const reserve = powerReserve(config);
  if (!reserve) return null;
  const [x, y] = POWER_RESERVE_POSITIONS[reserve.position]!;
  const r = RESERVE_RADIUS * radius;
  // Pivot sous le centre : l'éventail, qui monte vers 12 h, est centré sur la position.
  return { x: x * radius, y: y * radius - r * 0.45, r, style: reserve.style };
}

/** Angle de l'aiguille en degrés, sens horaire depuis 12 h (−50° vide, +50° plein). */
export function reserveAngle(level = RESERVE_LEVEL): number {
  return -RESERVE_HALF_ANGLE + 2 * RESERVE_HALF_ANGLE * level;
}
