import { effectiveDialColor, numeralColor } from './dial';
import { rehautColor } from './rehaut';
import type { HexColor, WatchConfig } from './types';

/** Pièces réglées dans le panneau latéral ; « indices » n'a que taille et position. */
export type ColorTarget =
  'dial' | 'hands' | 'seconds' | 'rehaut' | 'bezel' | 'numerals' | 'indices';
export interface ColorChoice {
  color: HexColor | 'match';
  finish: string;
  /** Chiffres : le même panneau règle aussi leur taille et leur distance au centre. */
  layout?: { size: number; radius: number };
}

/** Plages des curseurs de taille et de position des chiffres (facteurs de la référence). */
export const NUMERAL_SIZE_RANGE = { min: 0.7, max: 1.75 } as const;
export const NUMERAL_RADIUS_RANGE = { min: 0.6, max: 1.1 } as const;
export const INDEX_SIZE_RANGE = { min: 0.6, max: 1.6 } as const;
export const INDEX_RADIUS_RANGE = { min: 0.6, max: 1.1 } as const;
export const HAND_FINISHES = [
  { id: 'polished', name: 'Acier', color: '#E8EBF0' },
  { id: 'gold', name: 'Or', color: '#D3AA54' },
  { id: 'blued', name: 'Acier bleui', color: '#253F79' },
  { id: 'black', name: 'Noir', color: '#292E35' },
  { id: 'lacquer', name: 'Laqué', color: null },
] as const;

export function normalizeHex(value: string): HexColor | null {
  const trimmed = value.trim().replace(/^#/, '');
  if (/^[\da-f]{3}$/i.test(trimmed))
    return `#${[...trimmed]
      .map((c) => c + c)
      .join('')
      .toUpperCase()}`;
  return /^[\da-f]{6}$/i.test(trimmed) ? `#${trimmed.toUpperCase()}` : null;
}

export function handColor(config: WatchConfig): HexColor {
  if (config.hands.finish === 'lacquer') return config.hands.color;
  return HAND_FINISHES.find((f) => f.id === config.hands.finish)?.color ?? '#E8EBF0';
}

export function colorChoice(config: WatchConfig, target: ColorTarget): ColorChoice {
  if (target === 'bezel') return { color: config.bezel.color, finish: 'ceramic' };
  if (target === 'rehaut') return { color: config.rehaut.color, finish: config.rehaut.finish };
  if (target === 'indices')
    return {
      color: 'match',
      finish: config.dial.indices.finish,
      layout: { size: config.dial.indices.indexSize, radius: config.dial.indices.indexRadius },
    };
  if (target === 'numerals')
    return {
      color: config.dial.indices.numeralColor,
      finish: 'print',
      layout: { size: config.dial.indices.numeralSize, radius: config.dial.indices.numeralRadius },
    };
  return {
    color:
      target === 'dial'
        ? config.dial.color
        : target === 'hands'
          ? config.hands.color
          : config.hands.second.color,
    finish: config.hands.finish,
  };
}

/** Only the edited piece changes; copying a dial colour is an explicit snapshot. */
export function withColorChoice(
  config: WatchConfig,
  target: ColorTarget,
  choice: ColorChoice,
): WatchConfig {
  if (target === 'bezel')
    return choice.color === 'match'
      ? config
      : {
          ...config,
          bezel: { ...config.bezel, color: choice.color },
        };
  if (target === 'rehaut')
    return {
      ...config,
      rehaut: {
        ...config.rehaut,
        finish: choice.finish,
        color: choice.color === 'match' ? config.rehaut.color : choice.color,
      },
    };
  if (target === 'hands')
    return {
      ...config,
      hands: {
        ...config.hands,
        finish: choice.finish,
        color: choice.color === 'match' ? config.hands.color : choice.color,
      },
    };
  if (target === 'indices')
    return choice.layout
      ? {
          ...config,
          dial: {
            ...config.dial,
            indices: {
              ...config.dial.indices,
              indexSize: choice.layout.size,
              indexRadius: choice.layout.radius,
            },
          },
        }
      : config;
  if (target === 'numerals')
    return {
      ...config,
      dial: {
        ...config.dial,
        indices: {
          ...config.dial.indices,
          numeralColor: choice.color,
          ...(choice.layout
            ? { numeralSize: choice.layout.size, numeralRadius: choice.layout.radius }
            : {}),
        },
      },
    };
  if (target === 'seconds')
    return {
      ...config,
      hands: { ...config.hands, second: { ...config.hands.second, color: choice.color } },
    };
  if (choice.color === 'match') return config;
  return { ...config, dial: { ...config.dial, color: choice.color } };
}

export function targetColor(config: WatchConfig, target: ColorTarget): string {
  if (target === 'bezel') return config.bezel.color;
  if (target === 'rehaut') return rehautColor(config);
  if (target === 'dial') return effectiveDialColor(config.dial);
  if (target === 'numerals') return numeralColor(config.dial);
  // Applied indices are polished steel.
  if (target === 'indices') return '#E8EBF0';
  if (target === 'hands' || config.hands.second.color === 'match') return handColor(config);
  return config.hands.second.color;
}

/** HSV values use degrees and percentages; RGB storage stays compatible with old links. */
export function hsvToHex(h: number, s: number, v: number): HexColor {
  const saturation = Math.max(0, Math.min(100, s)) / 100;
  const value = Math.max(0, Math.min(100, v)) / 100;
  const channel = (n: number) => {
    const k = (n + (((h % 360) + 360) % 360) / 60) % 6;
    return Math.round(255 * (value - value * saturation * Math.max(0, Math.min(k, 4 - k, 1))))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`.toUpperCase() as HexColor;
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const value = normalizeHex(hex) ?? '#000000';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  const h =
    delta === 0
      ? 0
      : 60 *
        (max === r
          ? ((g - b) / delta + 6) % 6
          : max === g
            ? (b - r) / delta + 2
            : (r - g) / delta + 4);
  return { h, s: max ? (delta / max) * 100 : 0, v: max * 100 };
}
