/**
 * Date (quantième), première complication (spec §5.10). Elle vit dans
 * `config.complications` sous la forme `{ type: 'date', position, window, disc }` ;
 * les champs absents prennent les valeurs par défaut ci-dessous.
 *
 * Coordonnées normalisées par le rayon du cadran (spec §8.3), dans le repère 3D :
 * +X vers 3 h, +Y vers 12 h.
 */
import { getAtPath } from './path';
import type { WatchConfig } from './types';

export type DateWindow = 'framed' | 'plain';
export type DateDisc = 'white' | 'black' | 'dial';

export interface DateComplication {
  position: string;
  window: DateWindow;
  disc: DateDisc;
}

/** Centre du guichet, en fraction du rayon (§8.3). */
export const DATE_POSITIONS: Readonly<Record<string, readonly [number, number]>> = {
  '3h': [0.72, 0],
  '4h30': [0.58, -0.58],
  '6h': [0, -0.72],
  '12h': [0, 0.72],
};

/** Taille du guichet en fraction du rayon (§8.3 : 0,22 × 0,16). */
export const DATE_WINDOW_SIZE = { width: 0.22, height: 0.16 } as const;

/** Couleurs des disques, et de leurs chiffres. */
export const DATE_DISCS: Readonly<
  Record<Exclude<DateDisc, 'dial'>, { color: string; ink: string }>
> = {
  white: { color: '#F4F2EC', ink: '#16181C' },
  black: { color: '#15171B', ink: '#F2F1EC' },
};

/** La date de la configuration, valeurs par défaut comprises ; null sans guichet. */
export function dateComplication(config: WatchConfig): DateComplication | null {
  const raw = getAtPath(config, 'complications.date') as Record<string, unknown> | null;
  if (!raw || typeof raw['position'] !== 'string' || !(raw['position'] in DATE_POSITIONS))
    return null;
  return {
    position: raw['position'],
    window: raw['window'] === 'plain' ? 'plain' : 'framed',
    disc: raw['disc'] === 'black' || raw['disc'] === 'dial' ? raw['disc'] : 'white',
  };
}
