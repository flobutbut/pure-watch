/** A crown leaves the actual flank along its outward normal, not along a circle radius. */
import { shapeRadius } from './case-shape';
import { crownAngle, type WatchDimensions } from './dimensions';

export function crownMount(
  d: WatchDimensions,
  shape: string,
  position: string,
  surface = (theta: number) => d.caseRadius * shapeRadius(shape, theta),
) {
  const theta = crownAngle(position);
  const radius = surface(theta);
  const delta = 0.0001;
  const derivative = (surface(theta + delta) - surface(theta - delta)) / (2 * delta);
  const angle = theta - Math.atan2(derivative, radius);
  const x = radius * Math.cos(theta);
  const y = radius * Math.sin(theta);
  const reach = x * Math.cos(angle) + y * Math.sin(angle);
  // Translate the mounting frame tangentially. Its origin remains inside the convex case.
  return {
    angle,
    reach,
    x: x - reach * Math.cos(angle),
    y: y - reach * Math.sin(angle),
    contact: { x, y },
  };
}

/** Radial outline as seen from the translated mounting frame, for each guard root. */
export function mountedSurface(
  mount: ReturnType<typeof crownMount>,
  surface: (theta: number) => number,
  sign: 1 | -1,
) {
  const cache = new Map<number, number>();
  return (theta: number) => {
    const key = Math.round(theta * 1e7);
    const known = cache.get(key);
    if (known !== undefined) return known;
    const angle = mount.angle + sign * (theta - Math.PI / 2);
    let lo = 0;
    let hi = 200;
    for (let i = 0; i < 36; i++) {
      const r = (lo + hi) / 2;
      const x = mount.x + r * Math.cos(angle);
      const y = mount.y + r * Math.sin(angle);
      if (Math.hypot(x, y) < surface(Math.atan2(y, x))) lo = r;
      else hi = r;
    }
    cache.set(key, lo);
    return lo;
  };
}
