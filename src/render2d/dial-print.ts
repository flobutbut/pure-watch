/**
 * Impression du cadran en SVG (piste des minutes, textes). Coordonnées en mm, origine au
 * centre, y vers le bas (12 h en haut). Cette même source sert au rendu 2D et à la texture
 * du cadran 3D : ce que l'on voit dans la cellule est ce que l'on voit sur la montre (R6).
 */

export interface DialPrintOptions {
  dialRadius: number;
  /** Physical contour in the 3D convention (+X = 3 h, +Y = 12 h). */
  radiusAt?: (angle: number) => number;
  extent?: number;
  chapterRing: string;
  ink: string;
  /** Couleur de la piste des minutes (par défaut : l'encre). */
  chapterRingInk?: string;
  /** Scale of minute dots, preserving the relative size of five-minute marks. */
  chapterRingDotSize?: number;
  /** Jeu de chiffres (voir numeralHours) et famille typographique. */
  numerals?: string;
  numeralSystem?: 'arabic' | 'roman';
  numeralFont?: string;
  /** Couleur des chiffres des heures (par défaut : l'encre). */
  numeralInk?: string;
  /** Facteur de taille des chiffres (1 = référence). */
  numeralSize?: number;
  /** Facteur de distance des chiffres au centre (1 = position habituelle). */
  numeralRadius?: number;
  /** Heures (0 = 12 h) dont le chiffre cède la place à une complication. */
  omitHours?: readonly number[];
  /** Règles @font-face à embarquer (polices de style, voir fonts.ts). */
  fontCss?: string;
  brand?: string;
  line2?: string;
  /** Taille du rendu en pixels (attributs width/height du SVG). */
  sizePx?: number;
}

import { fontDef } from './fonts';
import { NUMERAL_RADIUS_RANGE } from '../core/config/colors';

const f = (n: number) => n.toFixed(3);

function polar(r: number, minute: number): [number, number] {
  const a = (minute / 60) * 2 * Math.PI;
  return [r * Math.sin(a), -r * Math.cos(a)];
}

function tick(r0: number, r1: number, minute: number, width: number): string {
  const [x0, y0] = polar(r0, minute);
  const [x1, y1] = polar(r1, minute);
  return `<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" stroke-width="${f(width)}"/>`;
}

function chapterRingMarkup(
  R: number,
  style: string,
  radiusAt?: (angle: number) => number,
  dotSize = 1,
): string {
  const radius = (minute: number, fraction: number) =>
    radiusAt
      ? radiusAt(Math.PI / 2 - (minute / 60) * Math.PI * 2) * 0.985 - R * (0.985 - fraction)
      : R * fraction;
  const mark = (r0: number, r1: number, minute: number, width: number) =>
    tick(radius(minute, r0), radius(minute, r1), minute, width);
  const track = (fraction: number) => {
    if (!radiusAt)
      return `<circle r="${f(R * fraction)}" fill="none" stroke-width="${f(R * 0.006)}"/>`;
    const path =
      Array.from({ length: 240 }, (_, i) => {
        const m = (i / 240) * 60;
        const [x, y] = polar(radius(m, fraction), m);
        return `${i === 0 ? 'M' : 'L'}${f(x)} ${f(y)}`;
      }).join('') + 'Z';
    return `<path d="${path}" fill="none" stroke-width="${f(R * 0.006)}"/>`;
  };
  const parts: string[] = [];
  switch (style) {
    case 'railroad':
      parts.push(track(0.985), track(0.93));
      for (let m = 0; m < 60; m++) {
        parts.push(mark(0.93, 0.985, m, m % 5 === 0 ? R * 0.014 : R * 0.006));
      }
      break;
    case 'ticks':
      for (let m = 0; m < 60; m++) {
        parts.push(mark(m % 5 === 0 ? 0.9 : 0.94, 0.985, m, m % 5 === 0 ? R * 0.016 : R * 0.007));
      }
      break;
    case 'dots':
      for (let m = 0; m < 60; m++) {
        const [x, y] = polar(radius(m, 0.955), m);
        parts.push(
          `<circle cx="${f(x)}" cy="${f(y)}" r="${f((m % 5 === 0 ? R * 0.016 : R * 0.007) * dotSize)}" stroke-width="${f(dotSize)}"/>`,
        );
      }
      break;
    case 'five-minute':
      for (let m = 0; m < 60; m += 5) parts.push(mark(0.91, 0.985, m, R * 0.014));
      break;
    default:
      break;
  }
  return parts.join('');
}

const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

/** Heures (0 = 12 h) qui portent un chiffre ; les index appliqués y sont retirés. */
export function numeralHours(set: string | undefined): number[] {
  switch (set) {
    case 'all':
    case 'roman':
      return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    case 'cardinal':
      return [0, 3, 6, 9];
    case 'explorer':
      return [3, 6, 9];
    case 'twelve':
      return [0];
    case 'six-twelve':
      return [0, 6];
    default:
      return [];
  }
}

/** Portée maximale des chiffres, en fraction du rayon : la même que celle des index. */
export const NUMERAL_REACH = 0.995;

function numeralsMarkup(
  R: number,
  set: string | undefined,
  fontId: string | undefined,
  radiusAt?: (angle: number) => number,
  omit: readonly number[] = [],
  sizeFactor = 1,
  radiusFactor = 1,
  system: 'arabic' | 'roman' = 'arabic',
): string {
  const hours = numeralHours(set).filter((h) => !omit.includes(h));
  if (hours.length === 0) return '';
  const font = fontDef(fontId);
  const roman = set === 'roman' || system === 'roman';
  const few = numeralHours(set).length <= 4;
  const reference = few ? 0.74 : 0.77;
  const fraction = reference * radiusFactor;
  // Rapprochés du centre, douze chiffres voisins se toucheraient : la taille est bornée par
  // l'écart entre deux heures (« 10 » ≈ 1,25 cadratin, « VIII » ≈ 2,2).
  const neighbours = 2 * R * fraction * Math.sin(Math.PI / (few ? 4 : 12));
  const size = Math.min(
    R * (few ? 0.2 : roman ? 0.12 : 0.14) * sizeFactor,
    neighbours / (roman ? 2.2 : 1.25),
  );
  return hours
    .map((h) => {
      const a = (h / 12) * 2 * Math.PI;
      const edge = radiusAt ? radiusAt(Math.PI / 2 - a) : R;
      // Jusqu'à 100 %, un grand chiffre s'arrête avant la minuterie (≈ 0,9 R).
      const standard = Math.min(edge * reference, edge * 0.9 - size * 0.4);
      // Au-delà, comme les index, il glisse vers le bord : au maximum du curseur, son bord
      // extérieur touche la limite des index, quelles que soient sa taille et sa police.
      const limit = Math.max(standard, edge * NUMERAL_REACH - size * 0.4);
      const reach = (radiusFactor - 1) / (NUMERAL_RADIUS_RANGE.max - 1);
      const radius =
        radiusFactor <= 1
          ? Math.min(edge * fraction, standard)
          : standard + (limit - standard) * Math.min(1, reach);
      const label = roman ? ROMAN[h]! : String(h === 0 ? 12 : h);
      return `<text x="${f(radius * Math.sin(a))}" y="${f(-radius * Math.cos(a))}" font-size="${f(size)}" font-family="${font.family}" font-weight="${font.weight}" font-style="${font.style ?? 'normal'}" text-anchor="middle" dominant-baseline="central">${label}</text>`;
    })
    .join('');
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function dialPrintSvg(options: DialPrintOptions): string {
  const R = options.dialRadius;
  const size = options.sizePx ?? 2048;
  const extent = options.extent ?? R;
  const text: string[] = [];
  const font = `font-family="Helvetica Neue, Helvetica, Arial, sans-serif" text-anchor="middle"`;
  if (options.brand) {
    text.push(
      `<text y="${f(-R * 0.4)}" font-size="${f(R * 0.085)}" letter-spacing="${f(R * 0.025)}" font-weight="500" ${font}>${escapeXml(options.brand)}</text>`,
    );
  }
  if (options.line2) {
    text.push(
      `<text y="${f(R * 0.48)}" font-size="${f(R * 0.05)}" letter-spacing="${f(R * 0.02)}" ${font}>${escapeXml(options.line2)}</text>`,
    );
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${f(-extent)} ${f(-extent)} ${f(2 * extent)} ${f(2 * extent)}">` +
    (options.fontCss ? `<style>${options.fontCss}</style>` : '') +
    `<g stroke="${options.chapterRingInk ?? options.ink}" fill="${options.chapterRingInk ?? options.ink}" stroke-linecap="butt">${chapterRingMarkup(R, options.chapterRing, options.radiusAt, options.chapterRingDotSize)}</g>` +
    `<g fill="${options.ink}">${text.join('')}</g>` +
    `<g fill="${options.numeralInk ?? options.ink}">${numeralsMarkup(R, options.numerals, options.numeralFont, options.radiusAt, options.omitHours, options.numeralSize, options.numeralRadius, options.numeralSystem)}</g>` +
    `</svg>`
  );
}

/** Encre lisible sur la couleur de cadran (voir core/config/dial). */
export { printInk as inkForDial } from '../core/config/dial';
