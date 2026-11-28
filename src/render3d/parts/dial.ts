/** Cadran : disque de matière, couche d'impression (texture SVG) et index appliqués. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { dialRadiusAt } from '../../core/geometry/dial-shape';
import { shapeRadius } from '../../core/geometry/case-shape';
import { shapeAperture } from './levels';
import { chapterRingColor, effectiveDialColor, numeralColor } from '../../core/config/dial';
import { hourMarkerAt, isDoubleIndex, numeralSystem } from '../../core/config/numerals';
import { complicationHours } from '../../core/config/complications';
import type { WatchConfig } from '../../core/config/types';
import type { WatchDimensions } from '../../core/geometry/dimensions';
import { dialPrintSvg, inkForDial, numeralHours } from '../../render2d/dial-print';
import { fontFaceCss } from '../../render2d/fonts';
import { latheZ } from '../lathe';
import { profileGeometry, type Sample } from './profile';
import { buildDate, dateWindowRect, roundedRect } from './date';
import { buildCounters, buildSubdial, circleOutline, subdialOf } from './subdial';
import { subdialStyle } from '../../core/config/subdial-style';
import { reserveCircle } from '../../core/config/power-reserve';
import { chronoCounters } from '../../core/config/chronograph';
import { buildReservePrint, buildReserveSurface } from './power-reserve';
import type { MaterialLibrary } from '../materials';
import { sharpPrint, svgTexture } from '../textures';
import { hasLume } from '../../core/config/lume';
import { INDEX_RADIUS_RANGE } from '../../core/config/colors';
import { indexAt } from '../../core/config/details';
import { indexPlate } from './inserts';
import { buildDialRing } from './dial-ring';
import { ringLift } from '../../core/config/dial-ring';
import { ringInk } from '../../core/config/subdials';
import { isFlatInk, numeralMaterial, numeralMaterialSettings } from '../../core/config/material';

export interface DialParts {
  dial: THREE.Group;
  print: THREE.Group;
  indices: THREE.Group;
  /** Image agrandie de la date, à poser avec le cristal (vide sans loupe). */
  loupe: THREE.Group;
  /** Résolue quand la texture d'impression est dessinée. */
  ready: Promise<void>;
  /** Ressources propres à cette montre (non partagées par la bibliothèque). */
  owned: { dispose(): void }[];
}

export function buildDial(
  config: WatchConfig,
  d: WatchDimensions,
  lib: MaterialLibrary,
  options: {
    print: boolean;
    printSize: number;
    day?: number;
    /** Dessus du cristal, pour l'image agrandie par une loupe de date. */
    crystalSurface?: (x: number, y: number) => number;
  } = { print: true, printSize: 2048 },
): DialParts {
  const R = d.dialSafeRadius;
  const windowRect = dateWindowRect(config, d);
  const subdial = subdialOf(config, d);
  const reserveCircleShape = reserveCircle(config, d.dialSafeRadius);
  const counterHoles =
    subdialStyle(config) === 'sunken' ? chronoCounters(config, d.dialSafeRadius) : [];
  // Ouvertures du cadran : guichet de date, cuvette d'un sous-cadran en creux.
  const holes = [
    ...(windowRect ? [roundedRect(windowRect)] : []),
    ...(subdial?.style === 'sunken' ? [circleOutline(subdial)] : []),
    ...counterHoles.map((circle) => circleOutline(circle)),
    ...(reserveCircleShape?.style === 'sunken' ? [circleOutline(reserveCircleShape)] : []),
  ];
  // Police de style éventuelle : chargée à la demande puis embarquée dans les SVG.
  const fontCss = fontFaceCss(config.dial.indices.numeralFont);
  // Chiffres en matière (métal, vernis, luminescent) : sortis de l'impression, ils ont
  // leur propre calque. L'encre mate reste imprimée, comme toujours.
  const numerals = numeralMaterial(config);
  const flatNumerals = isFlatInk(numerals);
  const followsIndices = numeralMaterialSettings(config).follow === 'indices';
  /** Impression du cadran, aux encres données (celles du fond, ou celles de l'anneau). */
  const printMarkup = (
    inks: { ink: string; chapterRingInk: string; numeralInk: string },
    layer: Partial<Parameters<typeof dialPrintSvg>[0]> = {},
  ) =>
    fontCss.then((fontCss) =>
      dialPrintSvg({
        fontCss,
        dialRadius: R,
        extent: d.dialExtent,
        radiusAt: d.dialShape === 'round' ? undefined : (angle) => dialRadiusAt(d, angle),
        chapterRing: config.dial.chapterRing,
        chapterRingDotSize: config.details?.chapterRing?.dotSize,
        chapterRingDetails: config.details?.chapterRing,
        brand: config.dial.text.brand,
        line2: config.dial.text.line2,
        numerals: config.dial.indices.numerals,
        hourMarkers: config.details?.hourMarkers,
        numeralSystem: numeralSystem(config.dial.indices),
        numeralFont: config.dial.indices.numeralFont,
        numeralSize: config.dial.indices.numeralSize,
        numeralRadius: config.dial.indices.numeralRadius,
        omitHours: complicationHours(config),
        ...inks,
        ...(flatNumerals ? {} : { numerals: 'none', hourMarkers: undefined }),
        ...layer,
      }),
    );
  /** Chiffres seuls, en blanc : leur forme (et, floutés sur noir, leur relief). */
  const numeralLayer = (layer: Partial<Parameters<typeof dialPrintSvg>[0]>) =>
    printMarkup(
      { ink: '#ffffff', chapterRingInk: '#ffffff', numeralInk: '#ffffff' },
      {
        chapterRing: 'none',
        brand: '',
        line2: '',
        numerals: config.dial.indices.numerals,
        hourMarkers: config.details?.hourMarkers,
        ...layer,
      },
    );
  const numeralInkOn = (ink: string) =>
    followsIndices
      ? numerals.kind === 'ink'
        ? numerals.color
        : ink
      : config.dial.indices.numeralColor === 'match'
        ? ink
        : config.dial.indices.numeralColor;

  const dial = new THREE.Group();
  dial.name = 'dial';
  dial.add(new THREE.Mesh(dialSurface(d, holes), lib.dial(config)));
  const reserveSurface = buildReserveSurface(config, d, lib);
  if (reserveSurface) dial.add(reserveSurface.surface);

  const print = new THREE.Group();
  print.name = 'print';
  const indices = buildIndices(config, d, lib);
  const date = buildDate(config, d, lib, {
    day: options.day ?? new Date().getDate(),
    fontCss,
    ...(options.crystalSurface ? { crystalSurface: options.crystalSurface } : {}),
  });
  if (date) {
    dial.add(date.recess);
    indices.add(date.frame);
  }
  const seconds = buildSubdial(config, d, lib, { fontCss, print: options.print });
  const counters = buildCounters(config, d, lib, { fontCss, print: options.print });
  for (const parts of [seconds, counters]) {
    if (!parts) continue;
    dial.add(parts.surface);
    print.add(parts.print);
  }
  // Anneau : le guichet et les sous-cadrans le traversent ; il imprime à sa propre encre.
  const ringInkColor = ringInk(config);
  const ring = buildDialRing(config, d, lib, {
    cutouts: [
      ...(windowRect ? [roundedRect(windowRect)] : []),
      ...(subdial ? [circleOutline(subdial)] : []),
      ...chronoCounters(config, d.dialSafeRadius).map((circle) => circleOutline(circle)),
      ...(reserveCircleShape ? [circleOutline(reserveCircleShape)] : []),
    ],
    markup: options.print
      ? printMarkup({
          ink: ringInkColor,
          chapterRingInk:
            config.dial.chapterRingColor === 'match' ? ringInkColor : config.dial.chapterRingColor,
          numeralInk: numeralInkOn(ringInkColor),
        })
      : null,
    printSize: options.printSize,
  });
  if (ring) {
    dial.add(ring.surface);
    print.add(ring.print);
  }
  const owned = [
    ...(ring?.owned ?? []),
    ...(date?.owned ?? []),
    ...(seconds?.owned ?? []),
    ...(counters?.owned ?? []),
    ...(reserveSurface?.owned ?? []),
  ];
  const dateReady = Promise.all([
    ring?.ready,
    date?.ready,
    seconds?.ready,
    counters?.ready,
    reserveSurface?.ready,
  ]).then(() => {});
  const loupe = date?.loupe ?? new THREE.Group();
  if (!options.print) {
    return { dial, print, indices, loupe, ready: dateReady, owned };
  }
  const reserve = buildReservePrint(config, d, fontCss);
  if (reserve) {
    print.add(reserve.print);
    owned.push(...reserve.owned);
  }

  // Impression : texture transparente posée juste au-dessus du disque, pour que la
  // matière du cadran (iridescence, soleillé) reste visible dessous.
  const markup = printMarkup({
    ink: inkForDial(effectiveDialColor(config.dial)),
    chapterRingInk: chapterRingColor(config.dial),
    numeralInk: numeralInkOn(numeralColor(config.dial)),
  });
  const { texture, ready } = svgTexture(markup, options.printSize);
  // Découpe alpha plutôt que transparence : la passe de transmission du cristal ne voit
  // que les objets opaques ; une impression « transparente » disparaîtrait sous le verre.
  const printMaterial = sharpPrint(
    new THREE.MeshStandardMaterial({
      map: texture,
      alphaTest: 0.35,
      roughness: 0.55,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      ...(ring?.printMask ? { alphaMap: ring.printMask } : {}),
    }),
  );
  const printMesh = new THREE.Mesh(dialSurface(d, holes), printMaterial);
  printMesh.position.z = 0.01;
  print.add(printMesh);

  const waits: Promise<void>[] = [];
  if (
    !flatNumerals &&
    numeralHours(config.dial.indices.numerals, config.details?.hourMarkers).length
  ) {
    const glyphs = svgTexture(numeralLayer({}), options.printSize);
    const relief =
      numerals.kind === 'metal' && numerals.effect === 'brushed'
        ? null
        : svgTexture(numeralLayer({ background: '#000000', numeralBlur: R * 0.004 }), 1024);
    if (relief) relief.texture.colorSpace = THREE.NoColorSpace;
    const span = Number((2 * d.dialExtent).toFixed(3));
    const layer = (ink: string, mask: THREE.Texture | null) => {
      const material = sharpPrint(
        lib.printed(numerals, glyphs.texture, relief?.texture ?? null, span, numeralInkOn(ink)),
      );
      if (mask) material.alphaMap = mask;
      owned.push(material);
      return material;
    };
    const plate = new THREE.Mesh(
      dialSurface(d, holes),
      layer(numeralColor(config.dial), ring?.printMask ?? null),
    );
    plate.position.z = 0.014;
    plate.name = 'numerals';
    print.add(plate);
    if (ring) {
      const band = ring.overlay(layer(ringInkColor, null));
      band.name = 'numerals';
      print.add(band);
    }
    owned.push(glyphs.texture, ...(relief ? [relief.texture] : []));
    waits.push(glyphs.ready, ...(relief ? [relief.ready] : []));
  }

  return {
    dial,
    print,
    indices,
    loupe,
    ready: Promise.all([ready, dateReady, reserve?.ready, ...waits]).then(() => {}),
    owned: [texture, printMaterial, ...owned],
  };
}

/* ---------- Index appliqués (spec §5.6) ---------- */

/**
 * Forme d'un index, axe = +Y (vers l'extérieur du cadran), centré sur l'origine.
 * `twin` : doublé à 12 h ; `big` : agrandi à 12 h.
 */
interface IndexDesign {
  geometry: () => THREE.BufferGeometry;
  radius: number;
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
      return { geometry: () => bar(R * 0.15, R * 0.045, 0.32), radius: R * 0.8 };
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
      return { geometry: () => bar(R * 0.22, R * 0.03, 0.3), radius: R * 0.77 };
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
      return { geometry: () => profile(samples, 0.22, 0.14 * k), radius: R * 0.8 };
    }
    default:
      return null;
  }
}

/**
 * Portée maximale des index, en fraction du rayon du cadran : au-delà du trait extérieur
 * de la minuterie (0,985 R), presque au réhaut.
 */
export const INDEX_REACH = 0.995;

function pairedIndexPlacement(
  bounds: THREE.Box3,
  size: number,
  radius: number,
  angle: number,
  d: WatchDimensions,
) {
  const halfWidth = Math.max(-bounds.min.x, bounds.max.x) * size;
  const halfGap = d.dialSafeRadius * 0.009;
  // Keep even wide pairs within the sector of the selected hour.
  const sector = (radius + bounds.min.y * size) * Math.tan(Math.PI / 12) * 0.9;
  const widthScale = Math.min(1, Math.max(0.1, (sector - halfGap) / (2 * halfWidth)));
  const offset = halfWidth * widthScale + halfGap;
  const side = offset + halfWidth * widthScale;
  const fits = (center: number) => {
    const front = center + bounds.max.y * size;
    return [-side, 0, side].every(
      (x) =>
        Math.hypot(x, front) <=
        dialRadiusAt(d, Math.PI / 2 - angle - Math.atan2(x, front)) * INDEX_REACH,
    );
  };
  if (fits(radius)) return { widthScale, offset, radius };
  // A pair reaches farther towards the outline than a single index, especially at corners.
  let low = 0;
  let high = radius;
  for (let i = 0; i < 10; i++) {
    const center = (low + high) / 2;
    if (fits(center)) low = center;
    else high = center;
  }
  return { widthScale, offset, radius: low };
}

export function buildIndices(
  config: WatchConfig,
  d: WatchDimensions,
  lib: MaterialLibrary,
  hours?: readonly number[],
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'indices';
  if (!hours && Object.keys(config.details?.indices ?? {}).length) {
    const plain = { ...config, details: { ...config.details, indices: undefined } };
    const ordinary = Array.from({ length: 12 }, (_, h) => h).filter(
      (h) => !config.details?.indices?.[String(h || 12)],
    );
    if (ordinary.length) group.add(buildIndices(plain, d, lib, ordinary));
    for (const key of Object.keys(config.details!.indices!)) {
      const hour = Number(key) % 12;
      const specific = indexAt(config, hour);
      const part = buildIndices(specific, d, lib, [hour]);
      part.name = `index-${key}h`;
      group.add(part);
    }
    return group;
  }
  // Each composition resolves to existing geometries, shared across its hours.
  const skip = new Set(complicationHours(config));
  // Longueur dans l'axe du rayon (Y de la forme), largeur en travers (X).
  const { indexLength: length, indexWidth: width, indexRadius: factor } = config.dial.indices;
  const luminous = hasLume(config.dial.indices);
  const printed = config.dial.indices.finish === 'printed';
  const units = new Map<
    string,
    {
      design: IndexDesign;
      unit: THREE.BufferGeometry;
      insert: THREE.BufferGeometry | null;
      radius: number;
    }
  >();
  const parts: THREE.BufferGeometry[] = [];
  const inserts: THREE.BufferGeometry[] = [];
  for (let hour = 0; hour < 12; hour++) {
    if (hours && !hours.includes(hour)) continue;
    if (skip.has(hour) || hourMarkerAt(config, hour) !== 'index') continue;
    const style = config.dial.indices.style === 'none' ? 'baton' : config.dial.indices.style;
    const resolved =
      style === 'dive'
        ? hour === 0
          ? 'triangles'
          : hour % 3 === 0
            ? 'baton'
            : 'dots'
        : style === 'mixed-batons'
          ? hour % 3 === 0
            ? 'baton-facet'
            : 'dots'
          : style;
    let prepared = units.get(resolved);
    if (!prepared) {
      const design = indexDesign(resolved, d.dialSafeRadius);
      if (!design) continue;
      let unit = design.geometry();
      let insert: THREE.BufferGeometry | null = null;
      if (luminous || printed) {
        const plate = indexPlate(unit, luminous, printed);
        unit.dispose();
        unit = plate.base;
        insert = plate.insert;
      }
      if (length !== 1 || width !== 1) {
        unit.scale(width, length, 1);
        insert?.scale(width, length, 1);
      }
      unit.computeBoundingBox();
      const half =
        Math.max(-unit.boundingBox!.min.y, unit.boundingBox!.max.y) * Math.max(1, design.big ?? 1);
      // Agrandis ou repoussés, les index peuvent recouvrir la minuterie jusqu'au réhaut.
      const outer = Math.max(design.radius + half / length, d.dialSafeRadius * INDEX_REACH);
      // Au-delà de 100 %, la position glisse vers le bord : au maximum du curseur, le bout
      // de l'index touche la limite, quelles que soient sa forme et sa taille.
      const edge = outer - half;
      const reach = (factor - 1) / (INDEX_RADIUS_RANGE.max - 1);
      const wanted =
        factor <= 1 ? design.radius * factor : design.radius + (edge - design.radius) * reach;
      prepared = { design, unit, insert, radius: Math.min(wanted, edge) };
      units.set(resolved, prepared);
    }
    const { design, unit, insert, radius: baseRadius } = prepared;
    const angle = (hour / 12) * Math.PI * 2;
    const size = hour === 0 ? (design.big ?? 1) : 1;
    const radius =
      d.dialShape === 'round'
        ? baseRadius
        : (baseRadius / d.dialSafeRadius) * dialRadiusAt(d, Math.PI / 2 - angle);
    const pair = isDoubleIndex(config, hour)
      ? pairedIndexPlacement(unit.boundingBox!, size, radius, angle, d)
      : null;
    const placement = pair?.radius ?? radius;
    const offsets = pair ? [-pair.offset, pair.offset] : [0];
    const elevation = ringLift(config, d.dialSafeRadius, placement);
    for (const dx of offsets) {
      for (const [source, destination] of [
        [unit, parts],
        [insert, inserts],
      ] as const) {
        if (!source) continue;
        const g = source.clone();
        if (pair || size !== 1) g.scale(size * (pair?.widthScale ?? 1), size, 1);
        // Sur un anneau en relief, l'index repose sur sa surface.
        g.translate(dx, placement, elevation);
        g.rotateZ(-angle);
        destination.push(g.index ? g.toNonIndexed() : g);
        if (g.index) g.dispose();
      }
    }
  }
  for (const { unit, insert } of units.values()) {
    unit.dispose();
    insert?.dispose();
  }
  if (parts.length === 0) return group;
  for (const g of parts) {
    g.deleteAttribute('uv');
    if (!g.getAttribute('normal')) g.computeVertexNormals();
  }
  const merged = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  const material =
    printed && luminous
      ? lib.luminous(config.dial.indices)
      : config.dial.indices.finish === 'applied-polished'
        ? lib.polishedSteel()
        : lib.indexMaterial(config);
  const base = new THREE.Mesh(merged, material);
  base.name = printed ? 'indices-printed' : 'indices-metal';
  group.add(base);
  if (inserts.length) {
    const joined = mergeGeometries(inserts);
    for (const g of inserts) g.dispose();
    const mesh = new THREE.Mesh(joined, lib.luminous(config.dial.indices));
    mesh.name = 'indices-lume';
    group.add(mesh);
  }
  return group;
}

/**
 * Physical XY UVs keep glyphs and grain undistorted on a non-circular face. With a date,
 * the face is a contour pierced by the window (the window itself keeps its proportions).
 */
function dialSurface(d: WatchDimensions, holes: THREE.Vector2[][] = []): THREE.BufferGeometry {
  if (holes.length > 0) {
    const outline = Array.from({ length: 160 }, (_, i) => {
      const angle = (i / 160) * Math.PI * 2;
      const k = d.dialShape === 'round' ? 1 : d.dialScale * shapeRadius(d.dialShape, angle);
      return new THREE.Vector2(
        d.dialRadius * k * Math.cos(angle),
        d.dialRadius * k * Math.sin(angle),
      );
    });
    const shape = new THREE.Shape(outline);
    for (const hole of holes) shape.holes.push(new THREE.Path(hole));
    const geometry = new THREE.ShapeGeometry(shape);
    const p = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < p.count; i++)
      uv.setXY(i, 0.5 + p.getX(i) / (2 * d.dialExtent), 0.5 + p.getY(i) / (2 * d.dialExtent));
    uv.needsUpdate = true;
    return geometry;
  }
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
