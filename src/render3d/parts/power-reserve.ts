/**
 * Réserve de marche (spec §5.10) : échelle imprimée en éventail et aiguille fixe qui
 * indique l'énergie restante.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  RESERVE_HALF_ANGLE,
  reserveAngle,
  reserveGauge,
  reserveCircle,
  type ReserveStyle,
} from '../../core/config/power-reserve';
import type { WatchConfig } from '../../core/config/types';
import type { WatchDimensions } from '../../core/geometry/dimensions';
import { fontDef } from '../../render2d/fonts';
import { sharpPrint, svgTexture } from '../textures';
import type { ReserveAdjustment } from '../../core/config/details';
import { boss, profileGeometry } from './profile';
import { reserveAppearance, subdialInk } from '../../core/config/subdials';
import { buildSubdialSurface, subdialFloor } from './subdial';
import { subdialStyle } from '../../core/config/subdial-style';
import type { MaterialLibrary } from '../materials';

/** Rouge de la zone « bas » (segments, jauge). */
const LOW = '#D2352B';
/** Demi-côté de la texture, en rayons d'éventail, autour du pivot. */
const SPAN = 1.15;

const f = (n: number) => n.toFixed(3);

/** Point à la distance `radius` du pivot, `angle` degrés depuis 12 h (sens horaire, y vers le bas). */
function at(radius: number, angle: number): [number, number] {
  const a = (angle * Math.PI) / 180;
  return [radius * Math.sin(a), -radius * Math.cos(a)];
}

/** Arc de cercle entre deux angles (sens horaire). */
function arc(radius: number, from: number, to: number): string {
  const [x0, y0] = at(radius, from);
  const [x1, y1] = at(radius, to);
  return `M${f(x0)} ${f(y0)}A${f(radius)} ${f(radius)} 0 0 1 ${f(x1)} ${f(y1)}`;
}

/** Angle d'un niveau de réserve (0 vide, 1 plein). */
const angleOf = (level: number) => -RESERVE_HALF_ANGLE + 2 * RESERVE_HALF_ANGLE * level;

/** Échelle de la réserve, centrée sur le pivot de l'aiguille (y vers le bas, 12 h en haut). */
export function reserveSvg(
  r: number,
  style: ReserveStyle,
  ink: string,
  font: { family: string; weight: string | number; style?: string },
  fontCss = '',
  settings: ReserveAdjustment = {},
): string {
  const low = settings.lowColor && settings.lowColor !== 'auto' ? settings.lowColor : LOW;
  const parts: string[] = [];
  const text = (x: number, y: number, size: number, label: string, fill = ink) =>
    parts.push(
      `<text x="${f(x)}" y="${f(y)}" font-size="${f(size)}" font-family="${font.family}" font-weight="${font.weight}" font-style="${font.style ?? 'normal'}" text-anchor="middle" dominant-baseline="central" stroke="none" fill="${fill}">${label}</text>`,
    );
  const tick = (r0: number, r1: number, level: number, width: number, color = ink) => {
    const [x0, y0] = at(r0, angleOf(level));
    const [x1, y1] = at(r1, angleOf(level));
    parts.push(
      `<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" stroke="${color}" stroke-width="${f(width)}"/>`,
    );
  };
  const line = (radius: number, from: number, to: number, width: number, color = ink) =>
    parts.push(
      `<path d="${arc(radius, angleOf(from), angleOf(to))}" fill="none" stroke="${color}" stroke-width="${f(width)}"/>`,
    );

  if (style === 'arc') {
    // Graduations de 5 en 5 h sur 40 h, chiffrées de 10 en 10.
    line(r, 0, 1, r * 0.025);
    for (let h = 0; h <= 40; h += 5) tick(h % 10 ? r * 0.88 : r * 0.8, r, h / 40, r * 0.03);
    for (let h = 0; h <= 40; h += 10) {
      const [x, y] = at(r * 0.64, angleOf(h / 40));
      text(x, y, r * 0.13, String(h));
    }
    const label = settings.label ?? 'RÉSERVE';
    text(
      0,
      r * 0.2,
      r * 0.1,
      label.replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
      ),
    );
  } else if (style === 'segments') {
    // Cinq pavés, le premier en rouge ; « bas » et « haut » aux extrémités.
    for (let i = 0; i < 5; i++) {
      const a0 = angleOf(i / 5) + 1.5;
      const a1 = angleOf((i + 1) / 5) - 1.5;
      const [x0, y0] = at(r, a0);
      const [x1, y1] = at(r, a1);
      const [x2, y2] = at(r * 0.8, a1);
      const [x3, y3] = at(r * 0.8, a0);
      parts.push(
        `<path d="M${f(x0)} ${f(y0)}A${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${f(r * 0.8)} ${f(r * 0.8)} 0 0 0 ${f(x3)} ${f(y3)}Z" fill="${i === 0 ? low : ink}" stroke="none"/>`,
      );
    }
    const [lx, ly] = at(r * 0.9, angleOf(0));
    const [hx, hy] = at(r * 0.9, angleOf(1));
    text(lx, ly + r * 0.22, r * 0.12, 'BAS');
    text(hx, hy + r * 0.22, r * 0.12, 'HAUT');
  } else {
    // Jauge de carburant : zone rouge à vide, quarts graduées.
    line(r, 0, 1, r * 0.025);
    line(r * 0.97, 0, 0.18, r * 0.07, low);
    for (const level of [0, 0.25, 0.5, 0.75, 1])
      tick(level === 0.5 || level % 1 === 0 ? r * 0.78 : r * 0.86, r, level, r * 0.035);
    const [ex, ey] = at(r * 0.62, angleOf(0));
    const [fx, fy] = at(r * 0.62, angleOf(1));
    text(ex, ey, r * 0.2, 'E', low);
    text(fx, fy, r * 0.2, 'F');
  }

  const half = r * SPAN;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="${f(-half)} ${f(-half)} ${f(2 * half)} ${f(2 * half)}">` +
    (fontCss ? `<style>${fontCss}</style>` : '') +
    `<g stroke-linecap="butt">${parts.join('')}</g></svg>`
  );
}

export interface ReserveParts {
  print: THREE.Group;
  ready: Promise<void>;
  owned: { dispose(): void }[];
}

/** Échelle imprimée de la réserve (calque de l'impression). */
export function buildReservePrint(
  config: WatchConfig,
  d: WatchDimensions,
  fontCss: Promise<string>,
): ReserveParts | null {
  const gauge = reserveGauge(config, d.dialSafeRadius);
  if (!gauge) return null;
  const font = fontDef(config.dial.indices.numeralFont);
  const settings = config.details?.reserve;
  const ink = subdialInk(config, true);
  const { texture, ready } = svgTexture(
    fontCss.then((css) => reserveSvg(gauge.r, gauge.style, ink, font, css, settings)),
    512,
  );
  const material = sharpPrint(
    new THREE.MeshStandardMaterial({
      map: texture,
      alphaTest: 0.35,
      roughness: 0.55,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * SPAN * gauge.r, 2 * SPAN * gauge.r),
    material,
  );
  mesh.position.set(gauge.x, gauge.y, subdialFloor(subdialStyle(config, 'reserve')) + 0.012);
  const print = new THREE.Group();
  print.name = 'reserve-print';
  print.add(mesh);
  return { print, ready, owned: [texture, material] };
}

/**
 * Aiguille bâton d'indicateur (réserve, compteurs) : pointe vers 12 h, pivot à l'origine,
 * avec son canon.
 */
export function stickHand(
  length: number,
  tail: number,
  k: number,
  material: THREE.Material,
): THREE.Mesh {
  const t = 0.1;
  const parts = [
    profileGeometry(
      [
        [-tail, 0.12 * k],
        [0, 0.12 * k],
        [length, 0.05 * k],
      ],
      t,
      0,
    ),
    boss(0.32 * k, t + 0.05),
  ];
  const geometry = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  return new THREE.Mesh(geometry, material);
}

/** Aiguille de la réserve, fixe sur son niveau (calque des aiguilles). */
export function buildReserveHand(
  config: WatchConfig,
  d: WatchDimensions,
  material: THREE.Material,
  customHand?: THREE.Mesh,
): THREE.Object3D | null {
  const gauge = reserveGauge(config, d.dialSafeRadius);
  if (!gauge || config.details?.reserve?.handStyle === 'none') return null;
  const hand =
    customHand ?? stickHand(gauge.r * 0.9, gauge.r * 0.18, d.dialSafeRadius / 20, material);
  hand.name = 'reserve-blade';
  const pivot = new THREE.Group();
  pivot.name = 'reserve-hand';
  pivot.position.set(gauge.x, gauge.y, subdialFloor(subdialStyle(config, 'reserve')) + 0.2);
  // Sens horaire vu de face = rotation négative autour de Z.
  pivot.rotation.z = (-reserveAngle() * Math.PI) / 180;
  pivot.add(hand);
  return pivot;
}

/** The reserve uses the same disc, azurage and recess builder as the other mini-dials. */
export function buildReserveSurface(config: WatchConfig, d: WatchDimensions, lib: MaterialLibrary) {
  const circle = reserveCircle(config, d.dialSafeRadius);
  if (!circle) return null;
  const appearance = reserveAppearance(config);
  const parts = buildSubdialSurface(
    d,
    lib,
    circle,
    appearance,
    Boolean(config.details?.reserve?.subdialStyle),
  );
  if (!parts.surface.children.length) return null;
  parts.surface.name = 'reserve-surface';
  return parts;
}
