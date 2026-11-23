/**
 * Dimensions dérivées d'une configuration, en millimètres (spec §8).
 *
 * Repère 3D : origine au centre du cadran, surface du cadran en z = 0, axe Y vers 12 h,
 * axe Z vers l'observateur (vue de face = caméra sur +Z). Les angles des aiguilles sont
 * comptés dans le sens horaire vu de face.
 */
import { contourExtents, effectiveDialShape, fitAperture } from './dial-shape';
import type { WatchConfig } from '../config/types';
import { dialOpeningFactor } from '../config/dial-size';
import { effectiveRehautProfile } from '../config/rehaut';

export interface WatchDimensions {
  /** Rayon extérieur du boîtier (hors couronne). */
  caseRadius: number;
  caseThickness: number;
  /** Largeur de la lunette vue de face. */
  bezelWidth: number;
  /** Rayon de l'ouverture de lunette (bord du cristal visible). */
  openingRadius: number;
  /** Rayon du cadran (sous le rehaut). */
  dialRadius: number;
  /** Shared physical contour; dialRadius remains the historical reference radius. */
  dialShape: string;
  dialScale: number;
  /** Inscribed circle for hands that must rotate through every angle. */
  dialSafeRadius: number;
  /** Half-size of the square print texture in millimetres. */
  dialExtent: number;
  /** Cotes en Z. */
  z: { back: number; bezelTop: number; crystalTop: number; dial: 0 };
  lugToLug: number;
  lugWidth: number;
  /** Épaisseur d'une corne (vue de face, perpendiculaire à l'entre-cornes). */
  lugThickness: number;
  hands: { hour: number; minute: number; second: number; secondTail: number };
  crown: { radius: number; length: number };
}

const DOME_HEIGHT_RATIO: Record<string, number> = {
  'sapphire-flat': 0.02,
  'sapphire-domed': 0.1,
  'sapphire-box': 0.18,
  mineral: 0.03,
  acrylic: 0.16,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function watchDimensions(config: WatchConfig): WatchDimensions {
  const diameter = config.case.diameterMm;
  const thickness = config.case.thicknessMm;
  const caseRadius = diameter / 2;
  const nominalBezel = clamp(diameter * 0.065, 1.4, 3.2);
  const openingFactor = dialOpeningFactor(config.dial.size);
  const requestedOpening = (caseRadius - nominalBezel) * openingFactor;
  const bezelWidth = openingFactor === 1 ? nominalBezel : caseRadius - requestedOpening;
  const dialShape = effectiveDialShape(config.dial.shape);
  // Circular apertures also need to fit the narrow sides of tonneau / rectangle cases.
  const available = caseRadius * contourExtents(config.case.shape).min - bezelWidth;
  const openingRadius =
    dialShape === 'round' && available < requestedOpening ? available * 0.998 : requestedOpening;
  // Le rehaut (anneau incliné entre lunette et cadran) mange ≈ 0,6 mm.
  const rehautWidth =
    effectiveRehautProfile(config) === 'classic'
      ? clamp(diameter * 0.015, 0.4, 0.8)
      : clamp(diameter * 0.045, 1, 2.2);
  const dialRadius = openingRadius - rehautWidth;

  const dialScale = fitAperture(config.case.shape, dialShape, caseRadius, openingRadius);
  const extents = contourExtents(dialShape);
  const dialSafeRadius =
    dialShape === 'round' ? dialRadius : dialRadius * dialScale * extents.min * 0.998;
  const dialExtent =
    dialShape === 'round' ? dialRadius : dialRadius * dialScale * extents.max * 1.002;

  // L'épaisseur annoncée va du fond au sommet du cristal.
  const bezelTop = 0.24 * thickness;
  const dome = (DOME_HEIGHT_RATIO[config.crystal.type] ?? 0.08) * thickness;
  const back = bezelTop + dome - thickness;

  // Longueurs d'aiguilles de référence pour un cadran de rayon 20 mm (spec §8.2).
  const k = dialSafeRadius / 20;

  return {
    caseRadius,
    caseThickness: thickness,
    bezelWidth,
    openingRadius,
    dialRadius,
    dialShape,
    dialScale,
    dialSafeRadius,
    dialExtent,
    z: { back, bezelTop, crystalTop: bezelTop + dome, dial: 0 },
    lugToLug: config.case.lugToLugMm,
    lugWidth: config.case.lugWidthMm,
    lugThickness: clamp(diameter * 0.065, 1.6, 3.2),
    hands: { hour: 12.5 * k, minute: 18.5 * k, second: 19.5 * k, secondTail: 5.5 * k },
    crown: { radius: clamp(diameter * 0.085, 2, 3.8), length: clamp(diameter * 0.07, 1.8, 3.4) },
  };
}

/**
 * Proportions par défaut associées à un diamètre de boîtier : entre-cornes (pair),
 * lug-to-lug et épaisseur. Utilisé pour les variantes de la ligne Taille.
 */
export function proportionsForDiameter(diameterMm: number) {
  return {
    diameterMm,
    lugToLugMm: Math.round(diameterMm * 1.18 * 2) / 2,
    lugWidthMm: 2 * Math.round(diameterMm / 4),
    thicknessMm: Math.round(diameterMm * 0.275 * 2) / 2,
  };
}

/**
 * Angle de la couronne autour de l'axe de la montre, en radians, mesuré depuis 3 h dans le
 * sens trigonométrique vu de face (4 h est sous 3 h : angle négatif).
 */
export function crownAngle(position: string): number {
  const hour = Number.parseFloat(position);
  if (!Number.isFinite(hour)) return 0;
  return ((3 - hour) * Math.PI) / 6;
}
