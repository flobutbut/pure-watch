/** Shared midcase sections and their buried attachment surfaces. All dimensions in mm. */
import type { WatchConfig } from '../../core/config/types';
import { effectiveCaseProfile } from '../../core/config/case-profile';
import { clamp, type WatchDimensions } from '../../core/geometry/dimensions';
import { shapeRadius } from '../../core/geometry/case-shape';
import type { P2, ProfileRun } from '../lathe';
import { caseLevels, flankRadiusAt } from './levels';

type Surface = 'brushed' | 'polished' | 'joint';

/** The back and bezel landing faces stay fixed, including the refined cushion joint. */
export function caseProfileRuns(
  profile: string,
  d: WatchDimensions,
  cushion = false,
): ProfileRun<Surface>[] | undefined {
  const kind = effectiveCaseProfile(profile);
  if (kind === 'curved') return;
  const { R, T, c, flankTop } = caseLevels(d);
  const start: P2 = cushion ? [R - c, d.z.back + T * 0.085] : [R - c * 2.2, d.z.back];
  const end: P2 = [R - c * (cushion ? 1.05 : 0.6), flankTop];
  const point = (r: number, t: number): P2 => [r, start[1] + (end[1] - start[1]) * t];
  const side = R - c * 0.6;
  if (kind === 'straight') {
    const lower = point(side, 0.09),
      upper = point(side, 0.96);
    return [
      { surface: 'polished', points: [start, lower] },
      { surface: 'brushed', points: [lower, upper] },
      { surface: 'polished', points: [upper, end] },
    ];
  }
  if (kind === 'faceted') {
    const lower = point(R, 0.3),
      upper = point(R, 0.7);
    return [
      { surface: 'polished', points: [start, lower] },
      { surface: 'brushed', points: [lower, upper] },
      { surface: 'polished', points: [upper, end] },
    ];
  }
  // Two inset tiers around a broad central belt. Small bevels catch the light on each ledge.
  const neck = Math.min(start[0], end[0], R - c * 1.8);
  const belt = R - c * 0.1;
  const a = point(neck, 0.07),
    b = point(neck, 0.25);
  const c1 = point(belt - c * 0.12, 0.25),
    c2 = point(belt, 0.27);
  const e = point(belt, 0.72),
    f = point(belt - c * 0.12, 0.74);
  const g = point(neck, 0.74),
    h = point(neck, 0.94);
  return [
    { surface: 'polished', points: [start, a] },
    { surface: 'brushed', points: [a, b] },
    { surface: 'polished', points: [b, c1, c2] },
    { surface: 'brushed', points: [c2, e] },
    { surface: 'polished', points: [e, f, g] },
    { surface: 'brushed', points: [g, h] },
    { surface: 'polished', points: [h, end] },
  ];
}

/** Minimum radius across a vertical attachment band: fillets remain buried on every tier. */
export function profileAttachmentSurface(
  config: WatchConfig,
  d: WatchDimensions,
  bottom: number,
  top: number,
  cushion = config.case.shape === 'cushion',
): (theta: number) => number {
  const runs = caseProfileRuns(config.case.profile, d, cushion);
  if (!runs) return flankRadiusAt(d, config.case.shape);
  let radius = Infinity;
  for (const { points } of runs) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!,
        b = points[i]!;
      if (b[1] < bottom || a[1] > top) continue;
      const at = (z: number) => a[0] + (b[0] - a[0]) * clamp((z - a[1]) / (b[1] - a[1]), 0, 1);
      // Horizontal ledges share a height; the inner edge is the safe attachment radius.
      radius = Math.min(
        radius,
        b[1] === a[1] ? Math.min(a[0], b[0]) : Math.min(at(bottom), at(top)),
      );
    }
  }
  if (!Number.isFinite(radius)) return flankRadiusAt(d, config.case.shape);
  const R = d.caseRadius;
  return (theta) => radius - 0.05 + (shapeRadius(config.case.shape, theta) - 1) * R;
}
