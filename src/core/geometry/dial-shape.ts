/** A single radial contour for the aperture, crystal, dial and printed furniture. */
import { CASE_SHAPES, shapeRadius } from './case-shape';
import type { WatchDimensions } from './dimensions';

export const DIAL_SHAPES = CASE_SHAPES;
const measurements = new Map<string, { min: number; max: number }>();

export function effectiveDialShape(shape: string | undefined): string {
  return DIAL_SHAPES.some((value) => value === shape) ? shape! : 'round';
}

export function contourExtents(shape: string) {
  let result = measurements.get(shape);
  if (!result) {
    let min = Infinity;
    let max = 0;
    for (let i = 0; i < 1024; i++) {
      const r = shapeRadius(shape, (i * Math.PI * 2) / 1024);
      min = Math.min(min, r);
      max = Math.max(max, r);
    }
    result = { min, max };
    measurements.set(shape, result);
  }
  return result;
}

const fits = new Map<string, number>();
/** Uniformly fit the chosen shape; keep a real metal wall around the entire aperture. */
export function fitAperture(
  caseShape: string,
  dialShape: string,
  R: number,
  opening: number,
): number {
  if (dialShape === 'round') return 1; // Preserve historical round faces exactly.
  const ratio = opening / R;
  const key = `${caseShape}:${dialShape}:${ratio.toFixed(8)}`;
  let scale = fits.get(key);
  if (scale === undefined) {
    scale = Infinity;
    for (let i = 0; i < 1024; i++) {
      const angle = (i * Math.PI * 2) / 1024;
      const available = R * shapeRadius(caseShape, angle) - (R - opening);
      scale = Math.min(scale, available / (opening * shapeRadius(dialShape, angle)));
    }
    scale *= 0.998; // Sampling and machining clearance, not a visible assembly gap.
    fits.set(key, scale);
  }
  return scale;
}

export function dialContourFactor(d: WatchDimensions, angle: number): number {
  return d.dialShape === 'round' ? 1 : d.dialScale * shapeRadius(d.dialShape, angle);
}

export function dialRadiusAt(d: WatchDimensions, angle: number): number {
  return d.dialRadius * dialContourFactor(d, angle);
}
