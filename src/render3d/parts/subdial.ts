/**
 * Sous-cadran de la petite seconde (spec §5.10) : graduations imprimées, et selon le style
 * un disque azuré (sillons concentriques) ou une cuvette creusée dans le cadran.
 */
import * as THREE from 'three';
import { effectiveDialColor } from '../../core/config/dial';
import { subdialCircle, type SubdialStyle } from '../../core/config/small-seconds';
import type { WatchConfig } from '../../core/config/types';
import type { WatchDimensions } from '../../core/geometry/dimensions';
import { inkForDial } from '../../render2d/dial-print';
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
  return style === 'sunken' ? -SUNKEN_DEPTH : style === 'azure' ? 0.004 : 0;
}

const f = (n: number) => n.toFixed(3);

/** Graduations des secondes, centrées sur le sous-cadran (y vers le bas, 60 en haut). */
export function subdialSvg(
  r: number,
  style: SubdialStyle,
  ink: string,
  font: { family: string; weight: string | number; style?: string },
  fontCss = '',
): string {
  const parts: string[] = [];
  const tick = (r0: number, r1: number, second: number, width: number) => {
    const a = (second / 60) * Math.PI * 2;
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
    for (let s = 0; s < 60; s++) tick(r * 0.82, r * 0.95, s, r * (s % 5 === 0 ? 0.04 : 0.018));
  } else {
    parts.push(`<circle r="${f(r * 0.97)}" fill="none" stroke-width="${f(r * 0.02)}"/>`);
    for (let s = 0; s < 60; s++)
      tick(s % 5 === 0 ? r * 0.78 : r * 0.87, r * 0.97, s, r * (s % 5 === 0 ? 0.045 : 0.02));
  }
  // Chiffres de dix en dix ; de quinze en quinze avec le chemin de fer, plus aéré.
  const labels = rail ? [15, 30, 45, 60] : [10, 20, 30, 40, 50, 60];
  const radius = rail ? r * 0.6 : r * 0.58;
  const size = r * (rail ? 0.2 : 0.17);
  for (const n of labels) {
    const a = (n / 60) * Math.PI * 2;
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
  const surface = new THREE.Group();
  surface.name = 'subdial';
  const print = new THREE.Group();
  print.name = 'subdial-print';
  const owned: { dispose(): void }[] = [];
  const waits: Promise<void>[] = [];
  const dialColor = effectiveDialColor(config.dial);

  if (c.style === 'azure') {
    const { texture, ready } = svgTexture(azureSvg(c.r), 1024);
    const material = new THREE.MeshStandardMaterial({
      color: dialColor,
      map: texture,
      bumpMap: texture,
      bumpScale: 0.35,
      roughness: 0.42,
      metalness: 0.15,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(c.r, 96), material);
    disc.position.set(c.x, c.y, subdialFloor('azure'));
    surface.add(disc);
    owned.push(texture, material);
    waits.push(ready);
  } else if (c.style === 'sunken') {
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
      const x = p.getX(i) + c.x;
      const y = p.getY(i) + c.y;
      uv.setXY(i, 0.5 + x / (2 * d.dialExtent), 0.5 + y / (2 * d.dialExtent));
    }
    floor.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = lib.dial(config).clone();
    material.vertexColors = true;
    const mesh = new THREE.Mesh(floor, material);
    mesh.position.set(c.x, c.y, -SUNKEN_DEPTH);
    surface.add(mesh);
    owned.push(material);
  }

  if (options.print) {
    const font = fontDef(config.dial.indices.numeralFont);
    const ink = inkForDial(dialColor);
    const { texture, ready } = svgTexture(
      options.fontCss.then((css) => subdialSvg(c.r, c.style, ink, font, css)),
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
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(c.r * 1.02, 96), material);
    mesh.position.set(c.x, c.y, subdialFloor(c.style) + 0.012);
    print.add(mesh);
    owned.push(texture, material);
    waits.push(ready);
  }

  return { surface, print, ready: Promise.all(waits).then(() => {}), owned };
}
