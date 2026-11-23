import { effectiveDialColor } from './dial';
import type { HexColor, WatchConfig } from './types';

export type ColorTarget = 'dial' | 'hands' | 'seconds';
export interface ColorChoice {
  color: HexColor | 'match';
  finish: string;
}
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
  if (target === 'hands')
    return {
      ...config,
      hands: {
        ...config.hands,
        finish: choice.finish,
        color: choice.color === 'match' ? config.hands.color : choice.color,
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
  if (target === 'dial') return effectiveDialColor(config.dial);
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
