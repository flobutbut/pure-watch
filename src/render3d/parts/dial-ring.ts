/**
 * Anneau du cadran : bande (ou disque central) d'une autre matière, à plat ou en relief.
 * Le guichet de date et les sous-cadrans le traversent : un masque alpha les découpe, ce qui
 * reste juste même quand une ouverture chevauche le bord de l'anneau.
 */
import * as THREE from 'three';
import { RING_RAISED_HEIGHT, ringRadii } from '../../core/config/dial-ring';
import { ringAppearance } from '../../core/config/subdials';
import type { WatchConfig } from '../../core/config/types';
import type { WatchDimensions } from '../../core/geometry/dimensions';
import type { MaterialLibrary } from '../materials';
import { sharpPrint, svgTexture } from '../textures';
import { shade, walls } from './date';
import { circleOutline } from './subdial';

const f = (n: number) => n.toFixed(3);
const MASK_SIZE = 1024;

/** Contour en coordonnées SVG (y vers le bas), comme l'impression du cadran. */
function outlinePath(outline: readonly THREE.Vector2[]): string {
  return `M${outline.map((p) => `${f(p.x)} ${f(-p.y)}`).join('L')}Z`;
}

/**
 * Masque de l'anneau : blanc sur la bande, noir ailleurs et dans les ouvertures. Inversé, il
 * garde l'impression du cadran partout sauf sur la bande (où l'anneau imprime à son encre).
 */
export function ringMaskSvg(
  extent: number,
  radii: { inner: number; outer: number },
  cutouts: readonly (readonly THREE.Vector2[])[],
  invert = false,
): string {
  const [on, off] = invert ? ['#000', '#FFF'] : ['#FFF', '#000'];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${MASK_SIZE}" height="${MASK_SIZE}" viewBox="${f(-extent)} ${f(-extent)} ${f(2 * extent)} ${f(2 * extent)}">` +
    `<rect x="${f(-extent)}" y="${f(-extent)}" width="${f(2 * extent)}" height="${f(2 * extent)}" fill="${off}"/>` +
    `<circle r="${f(radii.outer)}" fill="${on}"/>` +
    (radii.inner > 0 ? `<circle r="${f(radii.inner)}" fill="${off}"/>` : '') +
    cutouts.map((c) => `<path d="${outlinePath(c)}" fill="${off}"/>`).join('') +
    `</svg>`
  );
}

/** Bande ou disque, aux UV du cadran (mêmes motifs, même échelle que le fond). */
function ringGeometry(d: WatchDimensions, inner: number, outer: number): THREE.BufferGeometry {
  const geometry =
    inner > 0 ? new THREE.RingGeometry(inner, outer, 160, 2) : new THREE.CircleGeometry(outer, 160);
  const p = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < p.count; i++)
    uv.setXY(i, 0.5 + p.getX(i) / (2 * d.dialExtent), 0.5 + p.getY(i) / (2 * d.dialExtent));
  uv.needsUpdate = true;
  return geometry;
}

export interface DialRingParts {
  /** Matière de l'anneau (et ses flancs en relief), dans le calque du cadran. */
  surface: THREE.Group;
  /** Impression posée sur l'anneau, à son encre, dans le calque de l'impression. */
  print: THREE.Group;
  /** Masque à poser sur l'impression du cadran : elle s'efface sur la bande. */
  printMask: THREE.Texture | null;
  /** Calque posé sur la bande, découpé par son contour (chiffres en matière). */
  overlay: (material: THREE.MeshStandardMaterial) => THREE.Mesh;
  ready: Promise<void>;
  owned: { dispose(): void }[];
}

export function buildDialRing(
  config: WatchConfig,
  d: WatchDimensions,
  lib: MaterialLibrary,
  options: {
    cutouts: readonly (readonly THREE.Vector2[])[];
    /** Impression du cadran à l'encre de l'anneau ; null sans impression. */
    markup: Promise<string> | null;
    printSize: number;
  },
): DialRingParts | null {
  const radii = ringRadii(config, d.dialSafeRadius);
  if (!radii) return null;
  const { inner, outer, relief } = radii;
  const top = relief === 'raised' ? RING_RAISED_HEIGHT : 0.004;
  const appearance = ringAppearance(config);
  const owned: { dispose(): void }[] = [];
  const waits: Promise<void>[] = [];

  const mask = svgTexture(ringMaskSvg(d.dialExtent, radii, options.cutouts), MASK_SIZE);
  owned.push(mask.texture);
  waits.push(mask.ready);

  const surface = new THREE.Group();
  surface.name = 'dial-ring';
  const material = lib.dial(appearance.config).clone();
  material.alphaMap = mask.texture;
  material.alphaTest = 0.5;
  owned.push(material);
  const band = new THREE.Mesh(ringGeometry(d, inner, outer), material);
  band.position.z = top;
  surface.add(band);
  if (relief === 'raised') {
    // Flancs : vers l'extérieur au bord, vers le centre au bord intérieur.
    const side = lib.matte(shade(appearance.color, 0.55));
    const rim = circleOutline({ x: 0, y: 0, r: outer }, 160).reverse();
    const outerWall = new THREE.Mesh(walls(rim, top), side);
    outerWall.position.z = top;
    surface.add(outerWall);
    if (inner > 0) {
      const innerWall = new THREE.Mesh(
        walls(circleOutline({ x: 0, y: 0, r: inner }, 160), top),
        side,
      );
      innerWall.position.z = top;
      surface.add(innerWall);
    }
  }

  const print = new THREE.Group();
  print.name = 'dial-ring-print';
  let printMask: THREE.Texture | null = null;
  if (options.markup) {
    const printed = svgTexture(options.markup, options.printSize);
    const printMaterial = sharpPrint(
      new THREE.MeshStandardMaterial({
        map: printed.texture,
        alphaMap: mask.texture,
        alphaTest: 0.35,
        roughness: 0.55,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    );
    const mesh = new THREE.Mesh(ringGeometry(d, inner, outer), printMaterial);
    mesh.position.z = top + 0.012;
    print.add(mesh);
    const inverse = svgTexture(ringMaskSvg(d.dialExtent, radii, options.cutouts, true), MASK_SIZE);
    printMask = inverse.texture;
    owned.push(printed.texture, printMaterial, inverse.texture);
    waits.push(printed.ready, inverse.ready);
  }

  const overlay = (material: THREE.MeshStandardMaterial) => {
    material.alphaMap = mask.texture;
    const mesh = new THREE.Mesh(ringGeometry(d, inner, outer), material);
    mesh.position.z = top + 0.016;
    return mesh;
  };
  return {
    surface,
    print,
    printMask,
    overlay,
    ready: Promise.all(waits).then(() => {}),
    owned,
  };
}
