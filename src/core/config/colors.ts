import { chapterRingColor, effectiveDialColor, numeralColor } from './dial';
import { rehautColor } from './rehaut';
import { normalizeNumerals, numeralSystem, type NumeralSystem } from './numerals';
import { lumeChoice, withLume, type LumeChoice } from './lume';
import type { HexColor, WatchConfig } from './types';
import { handAdjustment, type HandLayout } from './hands';
import { bezelLayout, type BezelLayout } from './bezel';
import { lugJoin, type LugJoin } from './lugs';
import { cleanDetails, type WatchDetails } from './details';
import { subdialAppearance, reserveAppearance } from './subdials';

/** Pièces réglées dans le panneau latéral. */
export type ColorTarget =
  | 'dial'
  | 'hands'
  | 'seconds'
  | 'rehaut'
  | 'bezel'
  | 'numerals'
  | 'indices'
  | 'powerReserve'
  | 'subdials'
  | 'date'
  | 'lugs'
  | 'chapterRing';
export interface ColorChoice {
  details?: WatchDetails;
  complications?: WatchConfig['complications'];
  /** Date : loupe sur le verre, réglée dans le panneau de la date. */
  cyclops?: boolean;
  lugJoin?: LugJoin;
  handLayout?: HandLayout;
  bezelLayout?: BezelLayout;
  color: HexColor | 'match';
  finish: string;
  /**
   * Chiffres et index : le même panneau règle aussi leur taille et leur distance au centre.
   * Pour les index, `size` est la longueur et `width` la largeur, réglées séparément.
   */
  layout?: { size: number; radius: number; width?: number };
  numeralSystem?: NumeralSystem;
  lume?: LumeChoice;
}

/** Plages des curseurs de taille et de position des chiffres (facteurs de la référence). */
export const NUMERAL_SIZE_RANGE = { min: 0.7, max: 1.75 } as const;
export const NUMERAL_RADIUS_RANGE = { min: 0.6, max: 1.1 } as const;
export const INDEX_LENGTH_RANGE = { min: 0.6, max: 1.6 } as const;
export const INDEX_WIDTH_RANGE = { min: 0.6, max: 1.8 } as const;
export const INDEX_RADIUS_RANGE = { min: 0.6, max: 1.1 } as const;
export const HAND_FINISHES = [
  { id: 'polished', name: 'Acier', color: '#E8EBF0' },
  { id: 'gold', name: 'Or', color: '#D3AA54' },
  { id: 'blued', name: 'Acier bleui', color: '#253F79' },
  { id: 'black', name: 'Noir', color: '#292E35' },
  { id: 'lacquer', name: 'Laqué', color: null },
] as const;

export const INDEX_FINISHES = [
  { id: 'applied-polished', color: '#E8EBF0', name: 'polished' },
  { id: 'applied-gold', color: '#D3AA54', name: 'gold' },
  { id: 'applied-blued', color: '#253F79', name: 'blued' },
  { id: 'applied-black', color: '#292E35', name: 'black' },
  { id: 'applied-lacquer', color: null, name: 'lacquer' },
  { id: 'printed', color: null, name: 'printed' },
] as const;

export function indexColor(config: WatchConfig): HexColor {
  return (
    INDEX_FINISHES.find((f) => f.id === config.dial.indices.finish)?.color ??
    config.dial.indices.color
  );
}

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
    ...baseColorChoice(config, target),
    ...(config.details ? { details: config.details } : {}),
  };
}

function baseColorChoice(config: WatchConfig, target: ColorTarget): ColorChoice {
  // La date n'a pas de couleur propre : son panneau règle le guichet et le disque.
  if (target === 'date') return { color: 'match', finish: '', cyclops: config.crystal.cyclops };
  if (target === 'subdials')
    return { color: config.details?.subdials?.color ?? 'match', finish: '' };
  if (target === 'powerReserve')
    return { color: config.details?.reserve?.color ?? 'match', finish: '' };
  if (target === 'chapterRing') return { color: config.dial.chapterRingColor, finish: 'print' };
  if (target === 'lugs')
    return { color: targetColor(config, target) as HexColor, finish: '', lugJoin: lugJoin(config) };
  if (target === 'bezel')
    return { color: config.bezel.color, finish: 'ceramic', bezelLayout: bezelLayout(config) };
  if (target === 'rehaut') return { color: config.rehaut.color, finish: config.rehaut.finish };
  if (target === 'indices')
    return {
      color: config.dial.indices.color,
      finish: config.dial.indices.finish,
      lume: lumeChoice(config.dial.indices),
      layout: {
        size: config.dial.indices.indexLength,
        width: config.dial.indices.indexWidth,
        radius: config.dial.indices.indexRadius,
      },
    };
  if (target === 'numerals')
    return {
      color: config.dial.indices.numeralColor,
      finish: 'print',
      numeralSystem: numeralSystem(config.dial.indices),
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
    ...(target === 'hands'
      ? {
          lume: lumeChoice(config.hands),
          handLayout: {
            hour: handAdjustment(config.hands, 'hour'),
            minute: handAdjustment(config.hands, 'minute'),
          },
        }
      : {}),
  };
}

/** Only the edited piece changes; copying a dial colour is an explicit snapshot. */
export function withColorChoice(
  config: WatchConfig,
  target: ColorTarget,
  choice: ColorChoice,
): WatchConfig {
  const next = withBaseColorChoice(
    choice.complications ? { ...config, complications: choice.complications } : config,
    target,
    choice,
  );
  if (target === 'subdials' || target === 'powerReserve') {
    const section = target === 'subdials' ? 'subdials' : 'reserve';
    const details = cleanDetails(choice.details ?? config.details);
    if (choice.color === 'match' && !details?.[section]?.color)
      return details
        ? { ...next, details }
        : config.details
          ? { ...next, details: undefined }
          : next;
    return {
      ...next,
      details: { ...details, [section]: { ...details?.[section], color: choice.color } },
    };
  }
  if (!choice.details) return next;
  const details = cleanDetails(choice.details);
  if (!details && !config.details) return next;
  return { ...next, details };
}

function withBaseColorChoice(
  config: WatchConfig,
  target: ColorTarget,
  choice: ColorChoice,
): WatchConfig {
  if (target === 'date')
    return choice.cyclops === undefined
      ? config
      : { ...config, crystal: { ...config.crystal, cyclops: choice.cyclops } };
  if (target === 'powerReserve' || target === 'subdials') return config;
  if (target === 'chapterRing')
    return { ...config, dial: { ...config.dial, chapterRingColor: choice.color } };
  if (target === 'lugs')
    return { ...config, case: { ...config.case, lugJoin: choice.lugJoin ?? lugJoin(config) } };
  if (target === 'numerals') config = normalizeNumerals(config);
  if (target === 'bezel')
    return choice.color === 'match'
      ? config
      : {
          ...config,
          bezel: { ...config.bezel, color: choice.color, ...choice.bezelLayout },
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
        ...choice.handLayout,
        finish: choice.finish,
        color: choice.color === 'match' ? config.hands.color : choice.color,
        ...withLume(choice.lume),
      },
    };
  if (target === 'indices')
    return {
      ...config,
      dial: {
        ...config.dial,
        indices: {
          ...config.dial.indices,
          finish: choice.finish,
          color: choice.color === 'match' ? config.dial.indices.color : choice.color,
          ...withLume(choice.lume),
          ...(choice.layout
            ? {
                indexLength: choice.layout.size,
                indexWidth: choice.layout.width ?? config.dial.indices.indexWidth,
                indexRadius: choice.layout.radius,
              }
            : {}),
        },
      },
    };
  if (target === 'numerals')
    return {
      ...config,
      dial: {
        ...config.dial,
        indices: {
          ...config.dial.indices,
          numeralColor: choice.color,
          numeralSystem: choice.numeralSystem ?? numeralSystem(config.dial.indices),
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
  if (target === 'subdials') {
    return subdialAppearance(config).color;
  }
  if (target === 'powerReserve') return reserveAppearance(config).color;
  if (target === 'chapterRing') return chapterRingColor(config.dial);
  if (target === 'lugs')
    return rehautColor({ ...config, rehaut: { ...config.rehaut, finish: 'metal' } });
  if (target === 'bezel') return config.bezel.color;
  if (target === 'rehaut') return rehautColor(config);
  if (target === 'dial' || target === 'date') return effectiveDialColor(config.dial);
  if (target === 'numerals') return numeralColor(config.dial);
  if (target === 'indices') return indexColor(config);
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
