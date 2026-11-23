/** Machined bezel profiles and grip cuts. The glass seat and inner wall remain continuous. */
import * as THREE from 'three';
import { effectiveBezelType } from '../../core/config/bezel';
import type { WatchDimensions } from '../../core/geometry/dimensions';
import { clamp } from '../../core/geometry/dimensions';
import type { P2, ProfileRun } from '../lathe';
import { caseLevels } from './levels';

type Surface = 'brushed' | 'polished' | 'joint';
const patterned = (type: string) => ['fluted', 'coin', 'notched'].includes(type);

/** High angular detail only on the bezel, in multiples of the case's 192 segments. */
export function bezelSegments(type: string, points: readonly P2[], d: WatchDimensions): number {
  return patterned(type) && points.every(([, z]) => z >= caseLevels(d).flankTop - 1e-6) ? 576 : 192;
}

/** Alternative top profiles; callers retain their existing caseback and midcase. */
export function bezelProfile(
  type: string,
  d: WatchDimensions,
  root: P2,
): ProfileRun<Surface>[] | null {
  const kind = effectiveBezelType(type);
  if (kind === 'rotating') {
    const { R, c, seat, rehautTop } = caseLevels(d);
    const deck = seat - 0.12;
    const shoulder: P2 = [R - c, deck];
    return [
      { surface: 'polished', points: [root, shoulder] },
      { surface: 'brushed', points: [shoulder, [d.openingRadius, deck]] },
      {
        surface: 'brushed',
        points: [
          [d.openingRadius, deck],
          [d.openingRadius, rehautTop],
        ],
      },
    ];
  }
  if (kind !== 'rounded' && kind !== 'stepped') return null;
  const { R, T, c, flankTop, seat, rehautTop } = caseLevels(d);
  const top = d.z.bezelTop;
  const outer = R - c * 0.8;
  const inner = d.openingRadius + c * 0.35;
  const shoulder: P2 = [outer, top - c * 0.38];
  const start: P2[] = [root];
  if (Math.abs(root[0] - (R - c * 0.6)) > 1e-6) start.push([R - c * 0.6, flankTop]);
  start.push(shoulder);
  const runs: ProfileRun<Surface>[] = [{ surface: 'polished', points: start }];
  let end: P2;
  if (kind === 'rounded') {
    const curve: P2[] = Array.from({ length: 25 }, (_, i) => {
      const t = i / 24;
      return [outer + (inner - outer) * t, top - c * (0.08 + 0.3 * (2 * t - 1) ** 2)];
    });
    runs.push({ surface: 'polished', points: curve });
    end = curve[curve.length - 1]!;
  } else {
    const mid = (outer + inner) / 2;
    const high = top - Math.min(c * 0.06, T * 0.012);
    runs.push(
      { surface: 'brushed', points: [shoulder, [mid + c * 0.12, shoulder[1]]] },
      {
        surface: 'polished',
        points: [
          [mid + c * 0.12, shoulder[1]],
          [mid, high],
        ],
      },
      {
        surface: 'brushed',
        points: [
          [mid, high],
          [inner, high],
        ],
      },
    );
    end = [inner, high];
  }
  runs.push(
    { surface: 'polished', points: [end, [d.openingRadius, seat]] },
    {
      surface: 'brushed',
      points: [
        [d.openingRadius, seat],
        [d.openingRadius, rehautTop],
      ],
    },
  );
  return runs;
}

/** Cut the radial profile before shaping it to the case: the aperture itself is never cut. */
export function machineBezel(
  geometry: THREE.BufferGeometry,
  type: string,
  d: WatchDimensions,
): void {
  if (!patterned(type)) return;
  const { c, flankTop } = caseLevels(d);
  const p = geometry.getAttribute('position');
  const depth = Math.min(d.bezelWidth * 0.1, d.caseRadius * 0.012);
  const smooth = (x: number) => {
    const t = clamp(x, 0, 1);
    return t * t * (3 - 2 * t);
  };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      r = Math.hypot(x, y);
    if (r <= d.openingRadius || z <= flankTop) continue;
    const angle = Math.atan2(y, x);
    const band = (r - d.openingRadius) / d.bezelWidth;
    const rim = smooth((band - 0.14) / 0.5);
    const height = smooth((z - flankTop) / (c * 0.85));
    const count = type === 'fluted' ? 48 : type === 'coin' ? 72 : 12;
    const wave =
      type === 'notched'
        ? Math.max(0, Math.cos(count * angle)) ** 6
        : (0.5 + 0.5 * Math.cos(count * angle)) ** 2;
    const edge =
      type === 'coin'
        ? smooth((band - 0.5) / 0.3) * (1 - smooth((z - (d.z.bezelTop - c * 0.35)) / (c * 0.3)))
        : rim;
    const cut =
      depth * wave * height * edge * (type === 'notched' ? 1.35 : type === 'coin' ? 0.7 : 1);
    const radius = Math.max(d.openingRadius, r - cut);
    p.setXYZ(
      i,
      (x * radius) / r,
      (y * radius) / r,
      type === 'fluted'
        ? z - depth * 0.7 * wave * rim * smooth((z - (d.z.bezelTop - c * 0.8)) / (c * 0.65))
        : z,
    );
  }
  p.needsUpdate = true;
  geometry.computeVertexNormals();
}
