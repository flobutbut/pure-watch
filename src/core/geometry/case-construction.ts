import { caseConstruction } from '../config/case-construction';
import type { WatchConfig } from '../config/types';
import { shapeRadius } from './case-shape';
import type { WatchDimensions } from './dimensions';

/** Shared longitudinal curvature, from the top of the case towards the wrist. */
export function caseDomeDrop(
  config: WatchConfig,
  d: WatchDimensions,
  y: number,
  amount = caseConstruction(config).dome,
): number {
  const span = d.caseRadius * shapeRadius(config.case.shape, Math.PI / 2);
  return d.caseThickness * 0.12 * amount * (y / span) ** 2;
}
