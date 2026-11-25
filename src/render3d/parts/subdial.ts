/**
 * Sous-cadran de la petite seconde (spec §5.10) : graduations imprimées, et selon le style
 * un disque azuré (sillons concentriques) ou une cuvette creusée dans le cadran.
 */
import * as THREE from 'three';
import { effectiveDialColor } from '../../core/config/dial';
import { subdialStyle } from '../../core/config/subdial-style';
import { subdialAppearance, subdialInk } from '../../core/config/subdials';
import { subdialCircle, type SubdialStyle } from '../../core/config/small-seconds';
import { chronoCounters, COUNTER_DISCS, type CounterKind } from '../../core/config/chronograph';
import type { WatchConfig } from '../../core/config/types';
import type { WatchDimensions } from '../../core/geometry/dimensions';
import { fontDef } from '../../render2d/fonts';
import type { MaterialLibrary } from '../materials';
import { sharpPrint, svgTexture } from '../textures';
import { shade, walls } from './date';

/** Profondeur de la cuvette d'un sous-cadran en creux. */
export const SUNKEN_DEPTH = 0.4;

export interface SubdialCircle {
  x: number;
  y: number;
  r: number;
  style: SubdialStyle;
}

export function subdialOf(config: WatchConfig, d: WatchDimensions): SubdialCircle | null {
  return subdialCircle(config, d.dialSafeRadius);
}

/** Contour du sous-cadran, dans le sens trigonométrique. */
export function circleOutline(c: { x: number; y: number; r: number }, steps = 96) {
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return new THREE.Vector2(c.x + c.r * Math.cos(a), c.y + c.r * Math.sin(a));
  });
}

/** Hauteur de la surface du sous-cadran (le fond de la cuvette s'il est en creux). */
export function subdialFloor(style: SubdialStyle): number {
  return style === 'sunken' ? -SUNKEN_DEPTH : 0;
}

const f = (n: number) => n.toFixed(3);

/** Échelles des sous-cadrans : graduations, repères forts et chiffres. */
const SCALES: Readonly<
  Record<CounterKind, { count: number; major: number; labels: number[]; rail: number[] }>
> = {
  seconds: { count: 60, major: 5, labels: [10, 20, 30, 40, 50, 60], rail: [15, 30, 45, 60] },
  minutes: { count: 30, major: 5, labels: [10, 20, 30], rail: [10, 20, 30] },
  hours: { count: 12, major: 3, labels: [3, 6, 9, 12], rail: [3, 6, 9, 12] },
};

/**
 * Graduations d'un sous-cadran, centrées sur lui (y vers le bas, zéro en haut) : secondes
 * de la petite seconde, ou minutes et heures des compteurs d'un chronographe.
 */
export function subdialSvg(
  r: number,
  style: SubdialStyle | 'rail',
  ink: string,
  font: { family: string; weight: string | number; style?: string },
  fontCss = '',
  kind: CounterKind = 'seconds',
): string {
  const scale = SCALES[kind];
  const parts: string[] = [];
  const tick = (r0: number, r1: number, step: number, width: number) => {
    const a = (step / scale.count) * Math.PI * 2;
    const [s, c] = [Math.sin(a), -Math.cos(a)];
    parts.push(
      `<line x1="${f(r0 * s)}" y1="${f(r0 * c)}" x2="${f(r1 * s)}" y2="${f(r1 * c)}" stroke-width="${f(width)}"/>`,
    );
  };
  const rail = style === 'rail';
  if (rail) {
    parts.push(
      `<circle r="${f(r * 0.95)}" fill="none" stroke-width="${f(r * 0.018)}"/>`,
      `<circle r="${f(r * 0.82)}" fill="none" stroke-width="${f(r * 0.018)}"/>`,
    );
    for (let s = 0; s < scale.count; s++)
      tick(r * 0.82, r * 0.95, s, r * (s % scale.major === 0 ? 0.04 : 0.018));
  } else {
    parts.push(`<circle r="${f(r * 0.97)}" fill="none" stroke-width="${f(r * 0.02)}"/>`);
    for (let s = 0; s < scale.count; s++) {
      const major = s % scale.major === 0;
      tick(major ? r * 0.78 : r * 0.87, r * 0.97, s, r * (major ? 0.045 : 0.02));
    }
  }
  // Chiffres de dix en dix ; de quinze en quinze avec le chemin de fer, plus aéré.
  const labels = rail ? scale.rail : scale.labels;
  const radius = rail ? r * 0.6 : r * 0.58;
  const size = r * (labels.length <= 4 ? 0.2 : 0.17);
  for (const n of labels) {
    const a = (n / scale.count) * Math.PI * 2;
    parts.push(
      `<text x="${f(radius * Math.sin(a))}" y="${f(-radius * Math.cos(a))}" font-size="${f(size)}" font-family="${font.family}" font-weight="${font.weight}" font-style="${font.style ?? 'normal'}" text-anchor="middle" dominant-baseline="central" stroke="none">${n}</text>`,
    );
  }
  const half = r * 1.02;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="${f(-half)} ${f(-half)} ${f(2 * half)} ${f(2 * half)}">` +
    (fontCss ? `<style>${fontCss}</style>` : '') +
    `<g stroke="${ink}" fill="${ink}" stroke-linecap="butt">${parts.join('')}</g></svg>`
  );
}

/** Sillons concentriques de l'azurage, en niveaux de gris (multiplient la couleur du cadran). */
export function azureSvg(r: number): string {
  const grooves = Math.max(32, Math.round(r / 0.06));
  const rings: string[] = [];
  for (let i = grooves; i > 0; i--)
    rings.push(`<circle r="${f((r * i) / grooves)}" fill="${i % 2 ? '#FFFFFF' : '#E6E6E6'}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="${f(-r)} ${f(-r)} ${f(2 * r)} ${f(2 * r)}">${rings.join('')}</svg>`;
}

export interface SubdialParts {
  /** Disque azuré, ou cuvette (parois et fond), dans le calque du cadran. */
  surface: THREE.Group;
  /** Graduations imprimées, dans le calque de l'impression. */
  print: THREE.Group;
  ready: Promise<void>;
  owned: { dispose(): void }[];
}

export function buildSubdial(
  config: WatchConfig,
  d: WatchDimensions,
  lib: MaterialLibrary,
  options: { fontCss: Promise<string>; print: boolean },
): SubdialParts | null {
  const c = subdialOf(config, d);
  if (!c) return null;
  const appearance = subdialAppearance(config, effectiveDialColor(config.dial));
  const { surface, owned, ready } = buildSubdialSurface(d, lib, c, appearance);
  surface.name = 'subdial';
  const print = new THREE.Group();
  print.name = 'subdial-print';
  const waits: Promise<void>[] = [ready];

  if (options.print) {
    const font = fontDef(config.dial.indices.numeralFont);
    const ink = subdialInk(config);
    const printed = printDisc(
      options.fontCss.then((css) => subdialSvg(c.r, c.style, ink, font, css)),
      c,
      subdialFloor(c.style) + 0.012,
    );
    print.add(printed.mesh);
    owned.push(...printed.owned);
    waits.push(printed.ready);
  }

  return { surface, print, ready: Promise.all(waits).then(() => {}), owned };
}

/** Common disc and recess construction for seconds, chronograph counters and reserve. */
export function buildSubdialSurface(
  d: WatchDimensions,
  lib: MaterialLibrary,
  c: SubdialCircle,
  appearance: ReturnType<typeof subdialAppearance>,
  forceDisc = false,
) {
  const surface = new THREE.Group();
  const owned: { dispose(): void }[] = [];
  const waits: Promise<void>[] = [];
  const dialColor = appearance.color;
  if (c.style === 'sunken') {
    surface.add(
      new THREE.Mesh(walls(circleOutline(c), SUNKEN_DEPTH), lib.matte(shade(dialColor, 0.4))),
    );
    // Fond de la cuvette : même matière et mêmes coordonnées que le cadran autour, assombri
    // au pied de la paroi (ombre portée), pour que le creux se lise de face.
    const floor = new THREE.RingGeometry(0.001, c.r, 96, 10);
    const p = floor.getAttribute('position');
    const uv = floor.getAttribute('uv');
    const colors: number[] = [];
    for (let i = 0; i < p.count; i++) {
      const t = Math.hypot(p.getX(i), p.getY(i)) / c.r;
      const edge = Math.min(1, Math.max(0, (t - 0.7) / 0.3));
      const light = 1 - 0.5 * edge * edge;
      colors.push(light, light, light);
      const x = p.getX(i) + (appearance.customFinish ? 0 : c.x);
      const y = p.getY(i) + (appearance.customFinish ? 0 : c.y);
      const extent = appearance.customFinish ? c.r : d.dialExtent;
      uv.setXY(i, 0.5 + x / (2 * extent), 0.5 + y / (2 * extent));
    }
    floor.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = lib.dial(appearance.config, appearance.customFinish ? c.r : undefined).clone();
    material.vertexColors = true;
    const mesh = new THREE.Mesh(floor, material);
    mesh.position.set(c.x, c.y, -SUNKEN_DEPTH);
    surface.add(mesh);
    owned.push(material);
  } else if (forceDisc || appearance.customFinish || appearance.customColor) {
    surface.add(materialDisc(d, c, lib, appearance));
  }

  return { surface, owned, ready: Promise.all(waits).then(() => {}) };
}

/** Local UVs centre radial finishes on each counter; inherited surfaces retain main-dial UVs. */
function materialDisc(
  d: WatchDimensions,
  c: { x: number; y: number; r: number },
  lib: MaterialLibrary,
  appearance: ReturnType<typeof subdialAppearance>,
) {
  const geometry = new THREE.CircleGeometry(c.r, 96);
  if (!appearance.customFinish) {
    const p = geometry.getAttribute('position'),
      uv = geometry.getAttribute('uv');
    for (let i = 0; i < p.count; i++)
      uv.setXY(
        i,
        0.5 + (p.getX(i) + c.x) / (2 * d.dialExtent),
        0.5 + (p.getY(i) + c.y) / (2 * d.dialExtent),
      );
  }
  const mesh = new THREE.Mesh(
    geometry,
    lib.dial(appearance.config, appearance.customFinish ? c.r : undefined),
  );
  mesh.position.set(c.x, c.y, 0.004);
  return mesh;
}

/** Graduations imprimées d'un sous-cadran (découpe alpha, comme l'impression du cadran). */
function printDisc(markup: Promise<string>, c: { x: number; y: number; r: number }, z: number) {
  const { texture, ready } = svgTexture(markup, 512);
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
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(c.r * 1.02, 96), material);
  mesh.position.set(c.x, c.y, z);
  return { mesh, ready, owned: [texture, material] };
}

/**
 * Compteurs du chronographe : graduations de leur échelle, et pour le panda (inversé) un
 * disque azuré noir ou clair sous elles.
 */
export function buildCounters(
  config: WatchConfig,
  d: WatchDimensions,
  lib: MaterialLibrary,
  options: { fontCss: Promise<string>; print: boolean },
): SubdialParts | null {
  const counters = chronoCounters(config, d.dialSafeRadius);
  if (counters.length === 0) return null;
  const surface = new THREE.Group();
  surface.name = 'chrono-counters';
  const print = new THREE.Group();
  print.name = 'chrono-print';
  const owned: { dispose(): void }[] = [];
  const waits: Promise<void>[] = [];
  const font = fontDef(config.dial.indices.numeralFont);
  for (const c of counters) {
    const disc = c.colors === 'match' ? null : COUNTER_DISCS[c.colors];
    const appearance = subdialAppearance(config, disc?.color ?? effectiveDialColor(config.dial));
    const style = subdialStyle(config);
    const parts = buildSubdialSurface(d, lib, { ...c, style }, appearance, Boolean(disc));
    if (parts.surface.children.length) surface.add(...parts.surface.children.slice());
    owned.push(...parts.owned);
    waits.push(parts.ready);
    if (!options.print) continue;
    const ink = subdialInk(config);
    const printed = printDisc(
      options.fontCss.then((css) => subdialSvg(c.r, style, ink, font, css, c.kind)),
      c,
      subdialFloor(style) + 0.012,
    );
    print.add(printed.mesh);
    owned.push(...printed.owned);
    waits.push(printed.ready);
  }
  return { surface, print, ready: Promise.all(waits).then(() => {}), owned };
}
