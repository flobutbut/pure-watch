/** Cadran : disque de matière, couche d'impression (texture SVG) et index appliqués. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { dialRadiusAt } from '../../core/geometry/dial-shape';
import { shapeAperture } from './levels';
import { effectiveDialColor } from '../../core/config/dial';
import type { WatchConfig } from '../../core/config/types';
import type { WatchDimensions } from '../../core/geometry/dimensions';
import { dialPrintSvg, inkForDial, numeralHours } from '../../render2d/dial-print';
import { fontFaceCss } from '../../render2d/fonts';
import { latheZ } from '../lathe';
import { profileGeometry, type Sample } from './profile';
import type { MaterialLibrary } from '../materials';
import { svgTexture } from '../textures';

export interface DialParts {
  dial: THREE.Group;
  print: THREE.Group;
  indices: THREE.Group;
  /** Résolue quand la texture d'impression est dessinée. */
  ready: Promise<void>;
  /** Ressources propres à cette montre (non partagées par la bibliothèque). */
  owned: { dispose(): void }[];
}

export function buildDial(
  config: WatchConfig,
  d: WatchDimensions,
  lib: MaterialLibrary,
  options: { print: boolean; printSize: number } = { print: true, printSize: 2048 },
): DialParts {
  const R = d.dialSafeRadius;

  const dial = new THREE.Group();
  dial.name = 'dial';
  dial.add(new THREE.Mesh(dialSurface(d), lib.dial(config)));

  const print = new THREE.Group();
  print.name = 'print';
  const indices = buildIndices(config, d, lib);
  if (!options.print) {
    return { dial, print, indices, ready: Promise.resolve(), owned: [] };
  }

  // Impression : texture transparente posée juste au-dessus du disque, pour que la
  // matière du cadran (iridescence, soleillé) reste visible dessous.
  // Police de style éventuelle : chargée à la demande puis embarquée dans le SVG.
  const markup = fontFaceCss(config.dial.indices.numeralFont).then((fontCss) =>
    dialPrintSvg({
      fontCss,
      dialRadius: R,
      extent: d.dialExtent,
      radiusAt: d.dialShape === 'round' ? undefined : (angle) => dialRadiusAt(d, angle),
      chapterRing: config.dial.chapterRing,
      ink: inkForDial(effectiveDialColor(config.dial)),
      brand: config.dial.text.brand,
      line2: config.dial.text.line2,
      numerals: config.dial.indices.numerals,
      numeralFont: config.dial.indices.numeralFont,
    }),
  );
  const { texture, ready } = svgTexture(markup, options.printSize);
  // Découpe alpha plutôt que transparence : la passe de transmission du cristal ne voit
  // que les objets opaques ; une impression « transparente » disparaîtrait sous le verre.
  const printMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    alphaTest: 0.35,
    alphaToCoverage: true,
    roughness: 0.55,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const printMesh = new THREE.Mesh(dialSurface(d), printMaterial);
  printMesh.position.z = 0.01;
  print.add(printMesh);

  return { dial, print, indices, ready, owned: [texture, printMaterial] };
}

/* ---------- Index appliqués (spec §5.6) ---------- */

/**
 * Forme d'un index, axe = +Y (vers l'extérieur du cadran), centré sur l'origine.
 * `twin` : doublé à 12 h ; `big` : agrandi à 12 h.
 */
interface IndexDesign {
  geometry: () => THREE.BufferGeometry;
  radius: number;
  twin?: number;
  big?: number;
}

/** Bâton à bords arrondis (biseau), extrudé. */
function bar(length: number, width: number, depth: number): THREE.BufferGeometry {
  const bevel = Math.min(0.08, width * 0.2);
  const w = width / 2 - bevel;
  const l = length / 2 - bevel;
  const shape = new THREE.Shape();
  shape.moveTo(-w, -l);
  shape.lineTo(w, -l);
  shape.lineTo(w, l);
  shape.lineTo(-w, l);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
}

function profile(samples: Sample[], height: number, ridge: number): THREE.BufferGeometry {
  return profileGeometry(samples, height, ridge);
}

function indexDesign(style: string, R: number): IndexDesign | null {
  const k = R / 20;
  switch (style) {
    case 'baton':
      return { geometry: () => bar(R * 0.15, R * 0.045, 0.32), radius: R * 0.8, twin: R * 0.04 };
    case 'baton-facet': {
      const L = R * 0.16;
      const W = R * 0.055;
      return {
        geometry: () =>
          profile(
            [
              [-L / 2, W / 2],
              [L / 2, W / 2],
            ],
            0.22,
            0.16 * k,
          ),
        radius: R * 0.8,
        twin: R * 0.05,
      };
    }
    case 'dauphine': {
      const L = R * 0.18;
      const W = R * 0.08;
      return {
        geometry: () =>
          profile(
            [
              [-L / 2, 0],
              [L * 0.18, W / 2],
              [L / 2, W * 0.12],
            ],
            0.22,
            0.2 * k,
          ),
        radius: R * 0.79,
        twin: R * 0.06,
      };
    }
    case 'dots': {
      const r = R * 0.045;
      return {
        geometry: () =>
          latheZ(
            [
              [r, 0],
              [r, 0.18],
              [r * 0.8, 0.3],
              [r * 0.4, 0.36],
              [0, 0.37],
            ],
            40,
          ),
        radius: R * 0.84,
        twin: R * 0.06,
      };
    }
    case 'triangles': {
      const L = R * 0.13;
      const W = R * 0.1;
      return {
        geometry: () =>
          profile(
            [
              [-L / 2, 0],
              [L / 2, W / 2],
            ],
            0.24,
            0.12 * k,
          ),
        radius: R * 0.81,
        big: 1.4,
      };
    }
    case 'baguettes':
      return { geometry: () => bar(R * 0.22, R * 0.03, 0.3), radius: R * 0.77, twin: R * 0.03 };
    case 'drops': {
      const L = R * 0.15;
      const W = R * 0.08;
      const samples: Sample[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        samples.push([
          -L / 2 + t * L,
          (W / 2) * Math.pow(Math.sin(Math.PI * t), 0.55) * Math.pow(t, 0.7),
        ]);
      }
      return { geometry: () => profile(samples, 0.22, 0.14 * k), radius: R * 0.8, twin: R * 0.055 };
    }
    default:
      return null;
  }
}

function buildIndices(config: WatchConfig, d: WatchDimensions, lib: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  group.name = 'indices';
  const design = indexDesign(config.dial.indices.style, d.dialSafeRadius);
  if (!design) return group;

  // Les heures qui portent un chiffre n'ont pas d'index.
  const skip = new Set(numeralHours(config.dial.indices.numerals));
  const unit = design.geometry();
  const parts: THREE.BufferGeometry[] = [];
  for (let hour = 0; hour < 12; hour++) {
    if (skip.has(hour)) continue;
    const angle = (hour / 12) * Math.PI * 2;
    const twelve = hour === 0;
    const offsets = twelve && design.twin ? [-design.twin, design.twin] : [0];
    for (const dx of offsets) {
      const g = unit.clone();
      if (twelve && design.big) g.scale(design.big, design.big, 1);
      const radius =
        d.dialShape === 'round'
          ? design.radius
          : (design.radius / d.dialSafeRadius) * dialRadiusAt(d, Math.PI / 2 - angle);
      g.translate(dx, radius, 0);
      g.rotateZ(-angle);
      parts.push(g.index ? g.toNonIndexed() : g);
    }
  }
  unit.dispose();
  if (parts.length === 0) return group;
  for (const g of parts) {
    g.deleteAttribute('uv');
    if (!g.getAttribute('normal')) g.computeVertexNormals();
  }
  const merged = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  group.add(new THREE.Mesh(merged, lib.polishedSteel()));
  return group;
}

/** Physical XY UVs keep glyphs and grain undistorted on a non-circular face. */
function dialSurface(d: WatchDimensions): THREE.BufferGeometry {
  const geometry = new THREE.CircleGeometry(d.dialRadius, 160);
  shapeAperture(geometry, d);
  if (d.dialShape !== 'round') {
    const p = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < p.count; i++)
      uv.setXY(i, 0.5 + p.getX(i) / (2 * d.dialExtent), 0.5 + p.getY(i) / (2 * d.dialExtent));
    uv.needsUpdate = true;
  }
  return geometry;
}
