import type { WatchConfig } from '../../core/config/types';
import type { WatchDimensions } from '../../core/geometry/dimensions';
import { effectiveCaseProfile } from '../../core/config/case-profile';
import { latheZ } from '../lathe';
import { caseLevels, caseDeckTop, shapeLathe } from './levels';

/** Sample the same shaped shoulder as the case builder, including non-round apertures. */
export function lugShoulder(config: WatchConfig, d: WatchDimensions): (theta: number) => number {
  const { R, c } = caseLevels(d),
    z = caseDeckTop(d),
    count = 512;
  const geometry = latheZ(
    [
      [R - c, z],
      [R - c, z - 0.00001],
    ],
    count,
  );
  shapeLathe(
    geometry,
    d,
    config.case.shape,
    true,
    effectiveCaseProfile(config.case.profile) !== 'curved',
  );
  const samples = new Float64Array(count);
  samples.fill(Infinity);
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const angle = (Math.atan2(p.getY(i), p.getX(i)) + 2 * Math.PI) % (2 * Math.PI);
    const index = Math.round((angle / (2 * Math.PI)) * count) % count;
    samples[index] = Math.min(samples[index]!, Math.hypot(p.getX(i), p.getY(i)));
  }
  geometry.dispose();
  return (theta) => {
    const index = ((((theta / (2 * Math.PI)) * count) % count) + count) % count;
    const lo = Math.floor(index),
      t = index - lo;
    return samples[lo]! * (1 - t) + samples[(lo + 1) % count]! * t;
  };
}
