/**
 * Chronographe (spec §5.10) : compteurs en sous-cadrans, trotteuse centrale de chrono et
 * deux poussoirs. Il vit dans `config.complications` sous la forme
 * `{ type: 'chronograph', position: <disposition>, counters, pushers }` : sa « position »
 * est la disposition des compteurs, qui occupe plusieurs heures du cadran.
 *
 * Montre au repos : chrono arrêté, aiguilles des compteurs et trotteuse du chrono à zéro ;
 * seule la petite seconde (secondes courantes) tourne.
 */
import { getAtPath } from './path';
import type { WatchConfig } from './types';

export type CounterKind = 'seconds' | 'minutes' | 'hours';
export type CounterColors = 'match' | 'black' | 'light';
export type PusherStyle = 'round' | 'pump';

export interface Chronograph {
  layout: string;
  counters: CounterColors;
  pushers: PusherStyle;
}

interface Layout {
  /** Rayon des compteurs, en fraction du rayon du cadran (§8.3). */
  radius: number;
  counters: readonly { position: string; kind: CounterKind }[];
}

/** Dispositions, dans l'ordre de préférence (§8.3). */
export const CHRONO_LAYOUTS: Readonly<Record<string, Layout>> = {
  bicompax: {
    radius: 0.28,
    counters: [
      { position: '9h', kind: 'seconds' },
      { position: '3h', kind: 'minutes' },
    ],
  },
  tricompax: {
    radius: 0.26,
    counters: [
      { position: '9h', kind: 'seconds' },
      { position: '3h', kind: 'minutes' },
      { position: '6h', kind: 'hours' },
    ],
  },
  vertical: {
    radius: 0.28,
    counters: [
      { position: '6h', kind: 'seconds' },
      { position: '12h', kind: 'minutes' },
    ],
  },
};

/** Centre d'un compteur à chaque heure, en fraction du rayon (repère 3D, +Y vers 12 h). */
const CENTERS: Readonly<Record<string, readonly [number, number]>> = {
  '3h': [0.5, 0],
  '6h': [0, -0.5],
  '9h': [-0.5, 0],
  '12h': [0, 0.5],
};

/** Disques des compteurs panda et panda inversé, et l'encre de leurs graduations. */
export const COUNTER_DISCS: Readonly<
  Record<Exclude<CounterColors, 'match'>, { color: string; ink: string }>
> = {
  black: { color: '#17191D', ink: '#F2F1EC' },
  light: { color: '#ECEAE4', ink: '#1B1F27' },
};

export function chronograph(config: WatchConfig): Chronograph | null {
  const raw = getAtPath(config, 'complications.chronograph') as Record<string, unknown> | null;
  if (!raw || typeof raw['position'] !== 'string' || !(raw['position'] in CHRONO_LAYOUTS))
    return null;
  const counters = raw['counters'];
  return {
    layout: raw['position'],
    counters: counters === 'black' || counters === 'light' ? counters : 'match',
    pushers: raw['pushers'] === 'pump' ? 'pump' : 'round',
  };
}

/** Heures occupées par une disposition. */
export function layoutPositions(layout: string): string[] {
  return CHRONO_LAYOUTS[layout]?.counters.map((c) => c.position) ?? [];
}

/** Compteurs en mm, pour un cadran de rayon `radius`. */
export function chronoCounters(config: WatchConfig, radius: number) {
  const chrono = chronograph(config);
  if (!chrono) return [];
  const layout = CHRONO_LAYOUTS[chrono.layout]!;
  return layout.counters.map(({ position, kind }) => {
    const [x, y] = CENTERS[position]!;
    return {
      position,
      kind,
      x: x * radius,
      y: y * radius,
      r: layout.radius * radius,
      colors: chrono.counters,
    };
  });
}
