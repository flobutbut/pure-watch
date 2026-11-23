/**
 * Guichet de date (spec §5.10) : ouverture dans le cadran, disque imprimé du jour en
 * retrait, cerclage appliqué facultatif et loupe posée sur le cristal.
 */
import * as THREE from 'three';
import { effectiveDialColor } from '../../core/config/dial';
import {
  DATE_DISCS,
  DATE_POSITIONS,
  DATE_WINDOW_SIZE,
  dateComplication,
  type DateComplication,
} from '../../core/config/date';
import type { WatchConfig } from '../../core/config/types';
import type { WatchDimensions } from '../../core/geometry/dimensions';
import { inkForDial } from '../../render2d/dial-print';
import { fontDef } from '../../render2d/fonts';
import type { MaterialLibrary } from '../materials';
import { svgTexture } from '../textures';

/** Épaisseur du cadran traversée par le guichet, et retrait du disque sous le cadran. */
const DIAL_DEPTH = 0.4;
const DISC_GAP = 0.12;

export interface DateWindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
  corner: number;
}

/** Rectangle du guichet en mm (repère 3D), ou null sans date. */
export function dateWindowRect(config: WatchConfig, d: WatchDimensions): DateWindowRect | null {
  const date = dateComplication(config);
  if (!date) return null;
  const R = d.dialSafeRadius;
  const [cx, cy] = DATE_POSITIONS[date.position]!;
  const width = DATE_WINDOW_SIZE.width * R;
  const height = DATE_WINDOW_SIZE.height * R;
  return { x: cx * R, y: cy * R, width, height, corner: height * 0.14 };
}

/** Contour à coins arrondis, dans le sens trigonométrique. */
export function roundedRect(rect: DateWindowRect, grow = 0, steps = 6): THREE.Vector2[] {
  const w = rect.width / 2 + grow;
  const h = rect.height / 2 + grow;
  const r = Math.min(rect.corner + grow, w, h);
  const corners: [number, number, number][] = [
    [w - r, -h + r, -Math.PI / 2],
    [w - r, h - r, 0],
    [-w + r, h - r, Math.PI / 2],
    [-w + r, -h + r, Math.PI],
  ];
  const points: THREE.Vector2[] = [];
  for (const [cx, cy, start] of corners)
    for (let i = 0; i <= steps; i++) {
      const a = start + (i / steps) * (Math.PI / 2);
      points.push(new THREE.Vector2(rect.x + cx + r * Math.cos(a), rect.y + cy + r * Math.sin(a)));
    }
  return points;
}

function discColors(config: WatchConfig, date: DateComplication) {
  if (date.disc === 'dial') {
    const color = effectiveDialColor(config.dial);
    return { color, ink: inkForDial(color) };
  }
  return DATE_DISCS[date.disc];
}

/** Disque vu dans le guichet : fond, chiffre du jour et ombre portée par le bord du cadran. */
export function dateDiscSvg(
  rect: DateWindowRect,
  span: number,
  colors: { color: string; ink: string },
  day: number,
  font: { family: string; weight: string | number; style?: string },
  fontCss = '',
): string {
  const f = (n: number) => n.toFixed(3);
  const top = -rect.height / 2;
  const left = -rect.width / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="${f(-span / 2)} ${f(-span / 2)} ${f(span)} ${f(span)}">` +
    (fontCss ? `<style>${fontCss}</style>` : '') +
    `<defs>` +
    `<linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>` +
    `</defs>` +
    `<rect x="${f(-span / 2)}" y="${f(-span / 2)}" width="${f(span)}" height="${f(span)}" fill="${colors.color}"/>` +
    `<text x="0" y="${f(rect.height * 0.03)}" font-size="${f(rect.height * 0.78)}" font-family="${font.family}" font-weight="${font.weight}" font-style="${font.style ?? 'normal'}" text-anchor="middle" dominant-baseline="central" fill="${colors.ink}">${day}</text>` +
    `<rect x="${f(left)}" y="${f(top)}" width="${f(rect.width)}" height="${f(rect.height * 0.32)}" fill="url(#t)"/>` +
    `<rect x="${f(left)}" y="${f(top)}" width="${f(rect.width * 0.14)}" height="${f(rect.height)}" fill="url(#l)"/>` +
    `</svg>`
  );
}

export interface DateParts {
  /** Parois et disque, sous le cadran (calque du cadran). */
  recess: THREE.Group;
  /** Cerclage appliqué (calque des index). */
  frame: THREE.Group;
  ready: Promise<void>;
  owned: { dispose(): void }[];
}

function shade(hex: string, k: number): string {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  const c = (s: number) =>
    Math.round(((n >> s) & 255) * k)
      .toString(16)
      .padStart(2, '0');
  return `#${c(16)}${c(8)}${c(0)}`;
}

/** Parois verticales du guichet, normales tournées vers l'intérieur. */
function walls(outline: THREE.Vector2[], depth: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    // Contour trigonométrique : l'intérieur est à gauche du segment.
    const nx = -(b.y - a.y);
    const ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    const quad = [
      [a.x, a.y, 0],
      [b.x, b.y, 0],
      [b.x, b.y, -depth],
      [a.x, a.y, 0],
      [b.x, b.y, -depth],
      [a.x, a.y, -depth],
    ];
    for (const p of quad) {
      positions.push(...p);
      normals.push(nx / len, ny / len, 0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return g;
}

export function buildDate(
  config: WatchConfig,
  d: WatchDimensions,
  lib: MaterialLibrary,
  options: { day: number; fontCss: Promise<string>; textureSize?: number },
): DateParts | null {
  const date = dateComplication(config);
  const rect = dateWindowRect(config, d);
  if (!date || !rect) return null;

  const recess = new THREE.Group();
  recess.name = 'date';
  const outline = roundedRect(rect);
  const dialColor = effectiveDialColor(config.dial);
  recess.add(new THREE.Mesh(walls(outline, DIAL_DEPTH), lib.matte(shade(dialColor, 0.55))));

  // Le disque déborde du guichet pour rester visible de biais.
  const span = Math.max(rect.width, rect.height) + 1.2;
  const font = fontDef(config.dial.indices.numeralFont);
  const colors = discColors(config, date);
  const { texture, ready } = svgTexture(
    options.fontCss.then((css) => dateDiscSvg(rect, span, colors, options.day, font, css)),
    options.textureSize ?? 512,
  );
  const discMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.6,
    metalness: 0,
  });
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(span, span), discMaterial);
  disc.position.set(rect.x, rect.y, -DIAL_DEPTH - DISC_GAP);
  recess.add(disc);

  const frame = new THREE.Group();
  frame.name = 'date-frame';
  if (date.window === 'framed') {
    const width = Math.max(0.22, rect.height * 0.09);
    const shape = new THREE.Shape(roundedRect(rect, width));
    shape.holes.push(new THREE.Path(roundedRect(rect)));
    const bevel = 0.035;
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel / 2,
      bevelOffset: -bevel / 2,
      bevelSegments: 2,
      curveSegments: 4,
    });
    geometry.deleteAttribute('uv');
    frame.add(new THREE.Mesh(geometry, lib.polishedSteel()));
  }

  return { recess, frame, ready, owned: [texture, discMaterial] };
}

/**
 * Loupe (« cyclope ») collée sur le cristal au-dessus du guichet. `surfaceZ` donne la
 * hauteur du dessus du cristal à une position du cadran.
 */
export function buildCyclops(
  config: WatchConfig,
  d: WatchDimensions,
  material: THREE.Material,
  surfaceZ: (x: number, y: number) => number,
): THREE.Mesh | null {
  const rect = dateWindowRect(config, d);
  if (!rect || !config.crystal.cyclops) return null;
  const lens: DateWindowRect = {
    x: 0,
    y: 0,
    width: rect.width * 1.7,
    height: rect.height * 1.9,
    corner: rect.height * 0.8,
  };
  const thickness = Math.min(1.1, rect.height * 0.32);
  // Lentille bombée : anneaux du centre vers le contour, dessus presque plat, bord tombant.
  const rim = roundedRect({ ...lens, x: rect.x, y: rect.y }, 0, 8);
  const rings = 14;
  const positions: number[] = [];
  for (let ring = 0; ring <= rings; ring++) {
    const t = ring / rings;
    const height = thickness * Math.sqrt(Math.max(0, 1 - t ** 8));
    for (const b of rim) {
      const x = rect.x + (b.x - rect.x) * t;
      const y = rect.y + (b.y - rect.y) * t;
      // Collée au verre : la loupe suit son galbe.
      positions.push(x, y, surfaceZ(x, y) - 0.03 + height);
    }
  }
  const n = rim.length;
  const indices: number[] = [];
  for (let ring = 0; ring < rings; ring++)
    for (let i = 0; i < n; i++) {
      const a = ring * n + i;
      const b = ring * n + ((i + 1) % n);
      indices.push(a, a + n, b, b, a + n, b + n); // faces tournées vers l'avant
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'cyclops';
  mesh.renderOrder = 11;
  return mesh;
}
