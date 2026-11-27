/**
 * One envelope for the midcase, lugs and crown guards. The exterior contour is united
 * BEFORE its section is swept: bevels, rounded edges and normals follow that common
 * contour, with no buried solids or coincident faces at the attachments.
 *
 * Render layers are only partitions of the finished surface. They share the same
 * vertex positions and normals and do not define the construction of the case.
 */
import * as THREE from 'three';
import type { WatchConfig } from '../../core/config/types';
import { caseConstruction } from '../../core/config/case-construction';
import { caseDomeDrop } from '../../core/geometry/case-construction';
import { shapeRadius } from '../../core/geometry/case-shape';
import { crownMount } from '../../core/geometry/crown-mount';
import { clamp, type WatchDimensions } from '../../core/geometry/dimensions';
import type { MaterialLibrary } from '../materials';
import { caseDeckTop, caseLevels } from './levels';
import { guidedOutline, restoreBoundaryVertices } from '../../core/geometry/case-outline';
import { easeC2, bezierGuide } from '../../core/geometry/case-guides';
import { lugLayout, strapPocket } from './lugs';

type Point = { x: number; y: number };
type Part = 'case' | 'lugs';
interface Extension {
  part: Part;
  local: (x: number, y: number) => Point;
  inner: number;
  outer: number;
  start: number;
  tip: number;
  tipRadius: number;
  taperStart: number;
  taperOuter: number;
  taperInner: number;
  rootShift: number;
  /** Taper distribution: 0 = eased, 1 = holds its width and narrows into the tip. */
  swell: number;
  /** Transverse dome of the top, 0 = flat, 1 = domed (teardrop section). */
  round: number;
  /** Fillet radius on the outer side; the largest radius, used for bounds. */
  blend: number;
  /** Smaller fillet on the inner side, which faces the strap or the crown. */
  innerBlend?: number;
  bevel: number;
  profile: (y: number) => { top: number; bottom: number };
}

const smooth = easeC2;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** Round union: a circular fillet of the given radius where the two contours meet
 * (exact for perpendicular sides). The former cubic blend only dug about a sixth
 * of its radius, so even a "filled" root kept a visible crease. */
const union = (a: number, b: number, radius: number) => {
  if (!radius) return Math.min(a, b);
  const u = Math.max(radius - a, 0),
    v = Math.max(radius - b, 0);
  return Math.max(radius, Math.min(a, b)) - Math.hypot(u, v);
};

/** Sides of an extension at a local distance y, before the tip rounding. */
function extensionSides(e: Extension, y: number) {
  const p = clamp((y - e.taperStart) / Math.max(0.01, e.tip - e.taperStart), 0, 1);
  // Fullness redistributes the taper without ever widening the lug: the eased
  // narrowing becomes a convex outline that keeps its width and closes into the tip.
  const t = mix(smooth(p), p ** 2.5, e.swell);
  const rootShift = e.rootShift
    ? e.rootShift * (1 - smooth((y - e.start) / Math.max(0.1, e.taperStart - e.start)))
    : 0;
  const inner = e.inner + (e.inner < 0 ? e.taperOuter : e.taperInner) * t - rootShift;
  const outer = e.outer - e.taperOuter * t - rootShift;
  return { inner, outer };
}

function extensionDistance(e: Extension, p: Point, cutoff = Infinity): number {
  // This enclosing box is a lower bound on the extension's distance. Once it
  // cannot affect the union (or win the nearest-profile query), skip its curves.
  const bound = Math.max(e.inner - e.rootShift - p.x, p.x - e.outer, e.start - p.y, p.y - e.tip);
  if (bound >= cutoff) return bound;
  const { inner, outer } = extensionSides(e, p.y);
  const r = Math.min(e.tipRadius, (outer - inner) * 0.45, (e.tip - e.start) * 0.45);
  const x = Math.max(inner + r - p.x, p.x - outer + r);
  const y = Math.max(e.start + r - p.y, p.y - e.tip + r);
  return Math.hypot(Math.max(0, x), Math.max(0, y)) + Math.min(Math.max(x, y), 0) - r;
}

/** Shared layout also supplies the strap seat; changing the case never moves its bar independently. */
function extensions(config: WatchConfig, d: WatchDimensions): Extension[] {
  const result: Extension[] = [];
  const { R, T, c, flankTop } = caseLevels(d);
  const settings = caseConstruction(config);
  if (settings.attachment !== 'none') {
    const l = lugLayout(config, d, config.case.shape === 'cushion');
    for (const sx of l.style.integrated ? ([1] as const) : ([1, -1] as const))
      for (const sy of [1, -1] as const)
        result.push({
          part: 'lugs',
          local: (x, y) => ({ x: x * sx, y: y * sy }),
          inner: l.aIn,
          outer: d.lugWidth / 2 + l.thickness,
          start: R * 0.4,
          tip: l.yTip,
          tipRadius: l.tipRadius,
          taperStart: l.taperStart,
          taperOuter: (l.style.taper ?? 0) * l.thickness,
          taperInner: (l.style.taperInner ?? 0) * l.thickness,
          swell: settings.swell,
          round: settings.sectionRound,
          // Very wide imported straps still need a connected root. Splay only
          // the buried neck; the requested spacing at the bar stays unchanged.
          rootShift: l.style.integrated
            ? 0
            : Math.max(0, l.aIn - R * shapeRadius(config.case.shape, 0) * 0.75),
          // Leave room for the common edge even at a marked root; a tighter
          // concave radius would fold its chamfer on rectangular cases.
          blend:
            Math.max(0.2, l.bevel * 2.4) + settings.integration * clamp(l.thickness * 1.35, 1, 4),
          // The strap end sits between the lugs: a full outer fillet there would
          // fill its gap. A solid block has two outer sides and keeps the full radius.
          ...(l.style.integrated
            ? {}
            : {
                innerBlend:
                  Math.max(0.2, l.bevel * 2.4) +
                  settings.integration * clamp(l.thickness * 0.5, 0.5, 1.5),
              }),
          bevel: l.bevel,
          profile: l.profile,
        });
  }
  if (config.crown.style === 'guarded' || config.crown.guard) {
    const r = d.crown.radius;
    const mount = crownMount(d, config.case.shape, config.crown.position);
    const cos = Math.cos(mount.angle),
      sin = Math.sin(mount.angle);
    // All supported guarded heads fit this envelope, including the wider square head.
    const bodyRadius = r * (config.crown.style === 'square' ? 1.12 : 1);
    const thickness = clamp(r * 0.45, 1.1, 1.8);
    const crownZ = d.z.back + 0.48 * T;
    const top = Math.min(crownZ + r * 1.25, flankTop - 0.15, -0.15);
    const bottom = Math.max(crownZ - r * 1.25, d.z.back + c * 1.2 + 0.15);
    const guideStart = mount.reach - Math.max(3, r);
    const guideEnd = mount.reach + 0.9 + d.crown.length * 0.75;
    const topGuide = bezierGuide(
      guideStart,
      guideEnd,
      { value: caseDeckTop(d), slope: 0, curvature: 0 },
      { value: top, slope: 0, curvature: 0 },
    );
    const bottomGuide = bezierGuide(
      guideStart,
      guideEnd,
      { value: d.z.back, slope: 0, curvature: 0 },
      { value: Math.min(bottom, top - 0.3), slope: 0, curvature: 0 },
    );
    for (const sign of [1, -1])
      result.push({
        part: 'case',
        local: (x, y) => ({
          x: sign * (-(x - mount.x) * sin + (y - mount.y) * cos),
          y: (x - mount.x) * cos + (y - mount.y) * sin,
        }),
        inner: bodyRadius + 0.3,
        outer: bodyRadius + 0.3 + thickness,
        start: guideStart,
        tip: guideEnd,
        tipRadius: thickness * 0.4,
        taperStart: mount.reach,
        taperOuter: thickness * 0.12,
        taperInner: 0,
        rootShift: 0,
        swell: 0,
        round: 0,
        // The same root-depth control applies to every extension. Keep the
        // guard tips and crown clearance fixed while widening only their root.
        blend: 0.35 + settings.integration * clamp(thickness * 1.35, 1, 2.4),
        // The inner side faces the crown head, whose clearance stays free.
        innerBlend: 0.35 + settings.integration * 0.4,
        bevel: Math.min(settings.edge === 'sharp' ? 0.01 : settings.edgeSizeMm, thickness * 0.22),
        profile: (y) => ({
          top: topGuide.value(y),
          bottom: settings.underside === 'flat' ? d.z.back : bottomGuide.value(y),
        }),
      });
  }
  return result;
}

/** Analytic construction used by contour extraction, roof/base shaping and surface ownership. */
export function caseEnvelopeLayout(config: WatchConfig, d: WatchDimensions) {
  const exts = extensions(config, d);
  const { R, c } = caseLevels(d);
  const deck = caseDeckTop(d);
  const settings = caseConstruction(config);
  const body = (x: number, y: number) =>
    Math.hypot(x, y) - R * shapeRadius(config.case.shape, Math.atan2(y, x));
  const distance = (x: number, y: number) => {
    let f = body(x, y);
    for (const e of exts) {
      const local = e.local(x, y);
      const radius =
        e.innerBlend === undefined
          ? e.blend
          : mix(e.innerBlend, e.blend, smooth((local.x - e.inner) / (e.outer - e.inner)));
      f = union(f, extensionDistance(e, local, f + e.blend), radius);
    }
    return f;
  };
  const flatThreshold = Math.max(c * 1.5, 0.35 * Math.max(0.35, ...exts.map((e) => e.blend)));
  const requestedEdge = settings.edge === 'sharp' ? 0.01 : settings.edgeSizeMm;
  const flatSection = {
    top: deck,
    bottom: d.z.back,
    bevel: Math.min(requestedEdge, (deck - d.z.back) * 0.22),
    part: 'case' as Part,
  };
  // Lugless cases: the strap slides into a pocket carved from below at 12 and 6.
  // Its walls are steep but continuous (POCKET_WALL mm), so the underside stays a
  // single height field and its normals and triangles follow the same function.
  const pocket = strapPocket(config, d);
  const POCKET_WALL = 0.6;
  const nearPocket = (x: number, y: number) =>
    !!pocket &&
    Math.abs(x) < pocket.halfWidth + POCKET_WALL &&
    Math.abs(y) > pocket.back - POCKET_WALL;
  const pocketDepth = (x: number, y: number) =>
    pocket
      ? pocket.height *
        (1 - smooth((Math.abs(x) - pocket.halfWidth) / POCKET_WALL + 0.5)) *
        smooth((Math.abs(y) - pocket.back) / POCKET_WALL + 0.5)
      : 0;
  const section = (x: number, y: number) => {
    const b = body(x, y);
    if (b < -flatThreshold && !nearPocket(x, y)) return flatSection;
    const angle = Math.atan2(y, x),
      r = Math.hypot(x, y);
    const landing = R * shapeRadius(config.case.shape, angle) - c * 1.5;
    const shoulder = smooth((r - landing) / (c * 1.5));
    let top = deck - caseDomeDrop(config, d, y, settings.dome) * shoulder;
    let bottom = d.z.back,
      bevel = requestedEdge;
    let part: Part = 'case',
      strongest = 0.35;
    // Blend every active guide continuously. Selecting the nearest extension
    // switches height functions abruptly at their bisectors and produces ridges.
    for (const e of exts) {
      const local = e.local(x, y),
        reach = Math.max(0.35, e.blend);
      const f = extensionDistance(e, local, reach + 0.1);
      if (f >= reach + 0.1) continue;
      const weight = smooth((b + reach * 0.35) / reach) * (1 - smooth((f - 0.1) / reach));
      if (!weight) continue;
      const profile = e.profile(local.y);
      let extensionTop = profile.top;
      if (e.round) {
        // Transverse dome: the top falls towards both sides and the tip, like a drop.
        // It grows only once the lug has left the case, so the root stays planar.
        const { inner, outer } = extensionSides(e, local.y);
        const half = Math.max(0.2, (outer - inner) / 2);
        const depth = clamp(-f / half, 0, 1);
        const emerge = smooth(b / Math.max(1.5, e.blend));
        const amplitude = e.round * Math.min(half * 0.85, (profile.top - profile.bottom) * 0.45);
        extensionTop -= amplitude * emerge * (1 - depth) ** 2;
      }
      top = mix(top, extensionTop, weight);
      bottom = mix(bottom, profile.bottom, weight);
      bevel = mix(bevel, e.bevel, weight);
      if (e.part === 'lugs' && weight > strongest) {
        part = 'lugs';
        strongest = weight;
      }
    }
    if (settings.underside === 'flat') bottom = d.z.back;
    if (pocket) bottom = Math.max(bottom, d.z.back + pocketDepth(x, y));
    return { top, bottom, bevel: Math.min(bevel, (top - bottom) * 0.22), part };
  };
  return { distance, body, section, extensions: exts, pocket, nearPocket };
}

/** Plan-view outline of the united case, lugs and guards: the same contour the
 * envelope sweeps, sampled more coarsely for the settings schema. */
export function caseOutline(config: WatchConfig, d: WatchDimensions, step = 0.3): Point[] {
  const layout = caseEnvelopeLayout(config, d);
  const { R } = caseLevels(d);
  const extent = Math.max(R * 1.5 + d.crown.length + 5, d.lugToLug / 2 + 4);
  return contour(layout.distance, extent, Math.max(step, R / 60));
}

/** Marching squares over the analytic union, with shared edge vertices and no raster staircase. */
function contour(field: (x: number, y: number) => number, extent: number, step: number): Point[] {
  const count = Math.ceil((2 * extent) / step);
  const size = count + 1;
  const values = new Float64Array(size * size);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++)
      values[j * size + i] = field(i * step - extent, j * step - extent);
  const points: Point[] = [];
  const edges = new Map<string, number>();
  const neighbours = new Map<number, number[]>();
  const edge = (a: number, b: number) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    let id = edges.get(key);
    if (id !== undefined) return id;
    const t = values[a]! / (values[a]! - values[b]!);
    id = points.length;
    points.push({
      x: mix(a % size, b % size, t) * step - extent,
      y: mix(Math.floor(a / size), Math.floor(b / size), t) * step - extent,
    });
    edges.set(key, id);
    return id;
  };
  const connect = (a: number, b: number) => {
    neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
    neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
  };
  for (let j = 0; j < count; j++)
    for (let i = 0; i < count; i++) {
      const a = j * size + i,
        b = a + 1,
        d = a + size,
        c = d + 1;
      const corners = [a, b, c, d];
      const crossings: number[] = [];
      for (let k = 0; k < 4; k++) {
        const p = corners[k]!,
          q = corners[(k + 1) % 4]!;
        if (values[p]! < 0 !== values[q]! < 0) crossings.push(edge(p, q));
      }
      if (crossings.length === 2) connect(crossings[0]!, crossings[1]!);
      else if (crossings.length === 4) {
        const inside = field((i + 0.5) * step - extent, (j + 0.5) * step - extent) < 0;
        if (inside === values[a]! < 0) {
          connect(crossings[0]!, crossings[1]!);
          connect(crossings[2]!, crossings[3]!);
        } else {
          connect(crossings[0]!, crossings[3]!);
          connect(crossings[1]!, crossings[2]!);
        }
      }
    }
  const loops: Point[][] = [];
  const visited = new Set<number>();
  for (const start of neighbours.keys()) {
    if (visited.has(start)) continue;
    const loop: Point[] = [];
    let current = start,
      previous = -1;
    do {
      visited.add(current);
      loop.push(points[current]!);
      const next = neighbours.get(current)?.find((n) => n !== previous);
      if (next === undefined) throw new Error('Open case envelope contour');
      previous = current;
      current = next;
    } while (current !== start && !visited.has(current));
    loops.push(loop);
  }
  if (loops.length !== 1)
    throw new Error(`Case envelope needs one connected exterior, found ${loops.length}`);
  const loop = loops[0]!;
  if (THREE.ShapeUtils.isClockWise(loop.map((p) => new THREE.Vector2(p.x, p.y)))) loop.reverse();
  // Remove almost coincident crossings at grid corners; they otherwise make tiny folded bevels.
  const clean = loop.filter(
    (p, i) =>
      Math.hypot(
        p.x - loop[(i + loop.length - 1) % loop.length]!.x,
        p.y - loop[(i + loop.length - 1) % loop.length]!.y,
      ) >
      step * 0.025,
  );
  return simplifyLoop(clean, step * 0.055);
}

function simplifyLoop(clean: Point[], tolerance: number): Point[] {
  const simplify = (points: Point[]): Point[] => {
    const a = points[0]!,
      b = points[points.length - 1]!;
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length2 = dx * dx + dy * dy;
    let furthest = 0,
      distance = tolerance;
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i]!;
      const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / length2, 0, 1);
      const d = Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
      if (d > distance) {
        distance = d;
        furthest = i;
      }
    }
    if (!furthest) return [a, b];
    return [
      ...simplify(points.slice(0, furthest + 1)).slice(0, -1),
      ...simplify(points.slice(furthest)),
    ];
  };
  const half = Math.floor(clean.length / 2);
  const reduced = [
    ...simplify(clean.slice(0, half + 1)).slice(0, -1),
    ...simplify([...clean.slice(half), clean[0]!]).slice(0, -1),
  ];
  return reduced;
}

/** Conforming planar refinement: a shared edge is split on BOTH of its adjacent triangles. */
// Numeric keys: string keys allocated hundreds of thousands of short-lived strings
// per envelope. Vertex indices stay far below 2^21, so the key is exact.
const EDGE = 2 ** 21;
const edgeKey = (a: number, b: number) => (a < b ? a * EDGE + b : b * EDGE + a);

function refine(
  points: Point[],
  input: number[][],
  maxEdge: number,
  boundary: Set<number>,
  protectThin = true,
  height?: (point: Point) => number,
  /** Shortest edge still split for curvature; the pocket walls need finer steps. */
  minLength = 0.18,
  /** Also split edges that straddle a height step: long triangles reaching up a
   * steep wall stretch its shading across the flat floor. */
  steep = false,
): number[][] {
  let triangles = input;
  const heights: number[] = [];
  const at = (i: number) => (heights[i] ??= height!(points[i]!));
  const errors = new Map<number, number>();
  for (let pass = 0; pass < 12; pass++) {
    const midpoints = new Map<number, number>();
    const key = edgeKey;
    // Thin faces protect their edges for this pass only; the boundary is checked
    // separately instead of being copied into a new set on every pass.
    const protectedEdges = new Set<number>();
    for (const [a, b, c] of triangles as [number, number, number][]) {
      const p = points[a]!,
        q = points[b]!,
        r = points[c]!;
      const area = Math.abs((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
      const longest = Math.max(
        Math.hypot(q.x - p.x, q.y - p.y),
        Math.hypot(r.x - q.x, r.y - q.y),
        Math.hypot(p.x - r.x, p.y - r.y),
      );
      if (protectThin ? area / (longest * longest) < 0.001 : area / longest < 0.0001) {
        protectedEdges.add(key(a, b));
        protectedEdges.add(key(b, c));
        protectedEdges.add(key(c, a));
      }
    }
    for (const tri of triangles)
      for (let k = 0; k < 3; k++) {
        const a = tri[k]!,
          b = tri[(k + 1) % 3]!;
        const p = points[a]!,
          q = points[b]!;
        const edge = key(a, b);
        if (boundary.has(edge) || protectedEdges.has(edge) || midpoints.has(edge)) continue;
        const length = Math.hypot(p.x - q.x, p.y - q.y);
        // Refine curvature where needed, keeping the planar landing inexpensive.
        // A uniform coarse mesh misses the short curved shoulder; a uniformly
        // dense one wastes triangles over most of the case.
        let error = 0;
        if (height && length > minLength) {
          const known = errors.get(edge);
          error =
            known ??
            (steep && Math.abs(at(a) - at(b)) > 0.02
              ? Infinity
              : Math.abs(height({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }) - (at(a) + at(b)) / 2));
          errors.set(edge, error);
        }
        if (length <= maxEdge && error <= 0.008) continue;
        midpoints.set(edge, points.length);
        points.push({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
      }
    if (!midpoints.size) break;
    const output: number[][] = [];
    for (const [a, b, c] of triangles as [number, number, number][]) {
      const ab = midpoints.get(key(a, b)),
        bc = midpoints.get(key(b, c)),
        ca = midpoints.get(key(c, a));
      const mask =
        (ab !== undefined ? 1 : 0) + (bc !== undefined ? 2 : 0) + (ca !== undefined ? 4 : 0);
      switch (mask) {
        case 0:
          output.push([a, b, c]);
          break;
        case 1:
          output.push([a, ab!, c], [ab!, b, c]);
          break;
        case 2:
          output.push([b, bc!, a], [bc!, c, a]);
          break;
        case 4:
          output.push([c, ca!, b], [ca!, a, b]);
          break;
        case 3:
          output.push([b, bc!, ab!], [a, ab!, c], [ab!, bc!, c]);
          break;
        case 5:
          output.push([a, ab!, ca!], [ab!, b, c], [ab!, c, ca!]);
          break;
        case 6:
          output.push([c, ca!, bc!], [a, b, ca!], [b, bc!, ca!]);
          break;
        case 7:
          output.push([a, ab!, ca!], [ab!, b, bc!], [ca!, bc!, c], [ab!, bc!, ca!]);
          break;
      }
    }
    triangles = output;
  }
  return triangles;
}

/** Earcut can clip a zero-area ear whose apex lies on its opposite edge along a
 * straight wall. Such a sliver hides a long interior edge from refinement. Split
 * the neighbouring face at that apex instead: the sliver disappears and the mesh
 * stays closed, with no new vertex. */
function splitCollinearSlivers(points: Point[], input: number[][]): number[][] {
  let faces = input;
  for (let pass = 0; pass < 24; pass++) {
    const byEdge = new Map<number, number[]>();
    faces.forEach((face, index) => {
      for (let k = 0; k < 3; k++) {
        const key = edgeKey(face[k]!, face[(k + 1) % 3]!),
          list = byEdge.get(key);
        if (list) list.push(index);
        else byEdge.set(key, [index]);
      }
    });
    const dead = new Set<number>(),
      added: number[][] = [];
    faces.forEach((face, index) => {
      if (dead.has(index)) return;
      for (let k = 0; k < 3; k++) {
        const a = face[k]!,
          b = face[(k + 1) % 3]!,
          c = face[(k + 2) % 3]!;
        const A = points[a]!,
          B = points[b]!,
          C = points[c]!;
        const abx = B.x - A.x,
          aby = B.y - A.y,
          length = Math.hypot(abx, aby);
        if (length < 1e-9) continue;
        const along = ((C.x - A.x) * abx + (C.y - A.y) * aby) / (length * length);
        const offset = Math.abs(abx * (C.y - A.y) - aby * (C.x - A.x)) / length;
        if (along <= 1e-4 || along >= 1 - 1e-4 || offset > length * 1e-3) continue;
        const other = byEdge
          .get(edgeKey(a, b))!
          .find((j) => j !== index && !dead.has(j) && j < faces.length);
        if (other === undefined) continue;
        const g = faces[other]!,
          start = g.findIndex(
            (v, i) => (v === a || v === b) && (g[(i + 1) % 3] === a || g[(i + 1) % 3] === b),
          );
        const x = g[start]!,
          y = g[(start + 1) % 3]!,
          d = g[(start + 2) % 3]!;
        // Both halves must have area: a neighbour that is itself flat is left alone.
        const D = points[d]!;
        if (Math.abs(abx * (D.y - A.y) - aby * (D.x - A.x)) / length <= length * 1e-3) continue;
        dead.add(index);
        dead.add(other);
        added.push([x, c, d], [c, y, d]);
        return;
      }
    });
    if (!dead.size) break;
    faces = [...faces.filter((_, i) => !dead.has(i)), ...added];
  }
  return faces;
}

/** Improve the underside's triangle shapes without moving its outline or adding
 * an edge across the attachment cutouts. Each flip keeps the same convex patch. */
function improveFaces(
  points: Point[],
  faces: number[][],
  boundary: Set<number>,
  maxEdge = Infinity,
): number[][] {
  const area = (a: number, b: number, c: number) => {
    const p = points[a]!,
      q = points[b]!,
      r = points[c]!;
    return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  };
  const quality = (a: number, b: number, c: number) => {
    const p = points[a]!,
      q = points[b]!,
      r = points[c]!;
    return (
      Math.abs(area(a, b, c)) /
      ((p.x - q.x) ** 2 +
        (p.y - q.y) ** 2 +
        (q.x - r.x) ** 2 +
        (q.y - r.y) ** 2 +
        (r.x - p.x) ** 2 +
        (r.y - p.y) ** 2)
    );
  };
  for (let pass = 0; pass < 10; pass++) {
    // Each first-seen edge stores face * 3 + side. A face is only rewritten once it
    // is touched, and touched faces are skipped, so the stored face is still current.
    const edges = new Map<number, number>();
    // Flips happen in place, so the face count is fixed during a pass.
    const touched = new Uint8Array(faces.length);
    let changed = 0;
    for (let index = 0; index < faces.length; index++) {
      if (touched[index]) continue;
      const face = faces[index]!;
      for (let j = 0; j < 3; j++) {
        const a = face[j]!,
          b = face[(j + 1) % 3]!,
          c = face[(j + 2) % 3]!,
          key = edgeKey(a, b);
        if (boundary.has(key)) continue;
        const other = edges.get(key);
        if (other === undefined) {
          edges.set(key, index * 3 + j);
          continue;
        }
        const otherFace = Math.floor(other / 3);
        if (touched[otherFace]) continue;
        const d = faces[otherFace]![((other % 3) + 2) % 3]!;
        const oldQuality = Math.min(quality(a, b, c), quality(b, a, d));
        if (
          oldQuality > 1e-6 &&
          Math.hypot(points[c]!.x - points[d]!.x, points[c]!.y - points[d]!.y) > maxEdge
        )
          continue;
        if (area(a, b, c) * area(a, b, d) > 1e-7 || area(c, d, a) * area(c, d, b) >= -1e-12)
          continue;
        if (Math.min(quality(c, d, a), quality(d, c, b)) <= oldQuality * 1.01) continue;
        faces[index] = [c, d, a];
        faces[otherFace] = [d, c, b];
        touched[index] = 1;
        touched[otherFace] = 1;
        changed++;
        break;
      }
    }
    if (!changed) break;
  }
  return faces;
}

/** Remove microscopic interior edges left by a nearly flat contour. The link
 * condition and orientation checks preserve the boundary and the closed mesh. */
function collapseShortEdges(points: Point[], input: number[][], boundaryCount: number): number[][] {
  let faces = input;
  const area = (a: number, b: number, c: number) => {
    const p = points[a]!,
      q = points[b]!,
      r = points[c]!;
    return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  };
  for (let pass = 0; pass < 8; pass++) {
    const edges = new Map<number, { a: number; b: number; faces: number[] }>();
    faces.forEach((face, index) => {
      const a = points[face[0]!]!,
        b = points[face[1]!]!,
        c = points[face[2]!]!;
      const longest = Math.max(
        Math.hypot(a.x - b.x, a.y - b.y),
        Math.hypot(b.x - c.x, b.y - c.y),
        Math.hypot(c.x - a.x, c.y - a.y),
      );
      const sliver = Math.abs(area(face[0]!, face[1]!, face[2]!)) / longest < 1e-6;
      for (let j = 0; j < 3; j++) {
        const a = face[j]!,
          b = face[(j + 1) % 3]!;
        if (a < boundaryCount && b < boundaryCount) continue;
        const p = points[a]!,
          q = points[b]!;
        if (!sliver && Math.hypot(p.x - q.x, p.y - q.y) >= 0.02) continue;
        const key = edgeKey(a, b),
          edge = edges.get(key);
        if (edge) edge.faces.push(index);
        else edges.set(key, { a, b, faces: [index] });
      }
    });
    // Most passes find no collapsible edge: only then build the neighbourhoods,
    // and only around the candidate vertices (the checks never look further).
    const wanted = new Set<number>();
    for (const edge of edges.values()) if (edge.faces.length === 2) wanted.add(edge.a).add(edge.b);
    if (!wanted.size) break;
    const neighbours = new Map<number, Set<number>>(),
      incident = new Map<number, Set<number>>();
    faces.forEach((face, index) => {
      for (let j = 0; j < 3; j++) {
        const a = face[j]!;
        if (!wanted.has(a)) continue;
        if (!neighbours.has(a)) neighbours.set(a, new Set());
        neighbours.get(a)!.add(face[(j + 1) % 3]!);
        neighbours.get(a)!.add(face[(j + 2) % 3]!);
        if (!incident.has(a)) incident.set(a, new Set());
        incident.get(a)!.add(index);
      }
    });
    const replacements = new Map<number, number>(),
      touched = new Set<number>();
    for (const edge of edges.values()) {
      if (edge.faces.length !== 2) continue;
      let { a, b } = edge;
      if (b < boundaryCount) [a, b] = [b, a];
      const nearby = new Set([a, b, ...neighbours.get(a)!, ...neighbours.get(b)!]);
      if ([...nearby].some((id) => touched.has(id))) continue;
      if ([...neighbours.get(a)!].filter((id) => neighbours.get(b)!.has(id)).length !== 2) continue;
      let valid = true;
      for (const id of incident.get(b)!) {
        const old = faces[id]!,
          next = old.map((v) => (v === b ? a : v));
        if (new Set(next).size < 3) continue;
        const before = area(old[0]!, old[1]!, old[2]!),
          after = area(next[0]!, next[1]!, next[2]!);
        if (Math.abs(after) < 1e-8 || (Math.abs(before) > 1e-8 && before * after <= 0)) {
          valid = false;
          break;
        }
      }
      if (!valid) continue;
      replacements.set(b, a);
      for (const id of nearby) touched.add(id);
    }
    if (!replacements.size) break;
    faces = faces
      .map((face) => face.map((id) => replacements.get(id) ?? id))
      .filter((face) => new Set(face).size === 3);
  }
  return faces;
}

export interface CaseEnvelope {
  case: THREE.Group;
  lugs: THREE.Group;
}

/** One render partition of the envelope, as plain typed arrays: it can be computed
 * in a worker and transferred without copying, then assembled on the main thread. */
export interface EnvelopeMeshData {
  part: Part;
  name: 'envelope-surface' | 'envelope-edge';
  position: Float32Array;
  normal: Float32Array;
  tangent: Float32Array;
  uv: Float32Array;
  index: Uint16Array | Uint32Array;
}

/** The finished envelope, independent of materials and colours. */
export interface EnvelopeData {
  key: string;
  meshes: EnvelopeMeshData[];
  drilling: { radius: number; length: number; positions: [number, number, number][] } | null;
}

// Colour, finish and bezel decoration do not change the envelope. The cache owns its
// arrays; every watch assembles copies and can dispose them independently.
// The size row shows 14 variants beside the current watch: keep a whole row and
// evict the least recently used template, not the oldest. A template weighs about
// 1.2 to 2.3 MB, so this bounds the cache to some 25 MB.
const templates = new Map<string, EnvelopeData>();
const TEMPLATE_LIMIT = 16;

/** A cached envelope, marked as the most recently used. */
export function cachedEnvelope(key: string): EnvelopeData | undefined {
  const cached = templates.get(key);
  if (cached) {
    templates.delete(key);
    templates.set(key, cached);
  }
  return cached;
}

/** Keeps an envelope, computed here or in a worker, for the watches that follow. */
export function storeEnvelope(data: EnvelopeData): void {
  templates.delete(data.key);
  if (templates.size >= TEMPLATE_LIMIT) templates.delete(templates.keys().next().value!);
  templates.set(data.key, data);
}

/** The buffers to transfer when posting an envelope from a worker. */
export function envelopeTransfer(data: EnvelopeData): ArrayBuffer[] {
  return data.meshes.flatMap((m) =>
    [m.position, m.normal, m.tangent, m.uv, m.index].map((a) => a.buffer as ArrayBuffer),
  );
}

/** Everything the envelope reads from the configuration, and nothing else: the
 * crown head design, materials and colours share one template. */
export function envelopeKey(config: WatchConfig, d: WatchDimensions): string {
  const guard = config.crown.style === 'guarded' || config.crown.guard;
  return JSON.stringify([
    config.case.shape,
    caseConstruction(config),
    guard ? [config.crown.position, config.crown.style === 'square'] : null,
    d,
  ]);
}

/**
 * The envelope as meshes. An envelope already computed (by a worker, or earlier) is
 * only assembled; otherwise it is computed here, on the calling thread.
 */
export function buildCaseEnvelope(
  config: WatchConfig,
  d: WatchDimensions,
  lib: MaterialLibrary,
  prepared?: EnvelopeData | null,
): CaseEnvelope {
  const key = envelopeKey(config, d);
  const data =
    (prepared?.key === key ? prepared : undefined) ??
    cachedEnvelope(key) ??
    computeEnvelope(config, d);
  storeEnvelope(data);
  return assembleEnvelope(data, config, lib);
}

function assembleEnvelope(data: EnvelopeData, config: WatchConfig, lib: MaterialLibrary) {
  const groups: Record<Part, THREE.Group> = { case: new THREE.Group(), lugs: new THREE.Group() };
  groups.case.name = 'case';
  groups.lugs.name = 'lugs';
  for (const item of data.meshes) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(item.position.slice(), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(item.normal.slice(), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(item.uv.slice(), 2));
    // Use the same smooth frame on both sides of every triangle and render
    // partition. Per-face UV tangents make brushed metal reveal the triangulation.
    g.setAttribute('tangent', new THREE.BufferAttribute(item.tangent.slice(), 4));
    g.setIndex(new THREE.BufferAttribute(item.index.slice(), 1));
    const finish = item.name === 'envelope-edge' ? 'polished' : 'brushed';
    const mesh = new THREE.Mesh(g, lib.caseMetal(config, finish));
    mesh.name = item.name;
    groups[item.part].add(mesh);
  }
  // Visible drilling remains an independent detail, positioned from the common strap layout.
  if (data.drilling) {
    const { radius, length, positions } = data.drilling;
    const hole = new THREE.CylinderGeometry(radius, radius, length, 24);
    hole.rotateZ(Math.PI / 2);
    for (const position of positions) {
      const mesh = new THREE.Mesh(hole, lib.matte('#0b0c0e'));
      mesh.name = 'lug-drilling';
      mesh.position.fromArray(position);
      groups.lugs.add(mesh);
    }
  }
  return groups;
}

/** Computes the envelope. Pure: no materials, no cache, safe to run in a worker. */
export function computeEnvelope(config: WatchConfig, d: WatchDimensions): EnvelopeData {
  const key = envelopeKey(config, d);
  const layout = caseEnvelopeLayout(config, d);
  const { R, c } = caseLevels(d);
  const settings = caseConstruction(config);
  const rounded = settings.edge === 'rounded';
  const extent = Math.max(R * 1.5 + d.crown.length + 5, d.lugToLug / 2 + 4);
  const step = Math.max(0.12, R / 90);
  const perimeterOutline = contour(layout.distance, extent, step);
  const outline = guidedOutline(perimeterOutline, Math.max(0.3, step * 1.8));
  const positions: number[] = [],
    normals: number[] = [],
    tangents: number[] = [],
    uvs: number[] = [],
    indices: number[] = [],
    surfaces: number[] = [];
  const vertex = (x: number, y: number, z: number, u = x / 12, v = y / 12) => {
    const index = positions.length / 3;
    positions.push(x, y, z);
    normals.push(0, 0, 1);
    tangents.push(1, 0, 0, 1);
    uvs.push(u, v);
    return index;
  };
  const setNormal = (id: number, n: THREE.Vector3) => {
    normals[id * 3] = n.x;
    normals[id * 3 + 1] = n.y;
    normals[id * 3 + 2] = n.z;
    const tangent = new THREE.Vector3(1, 0, 0).addScaledVector(n, -n.x);
    if (tangent.lengthSq() < 1e-10) tangent.set(0, 1, 0).addScaledVector(n, -n.y);
    tangent.normalize();
    tangents[id * 4] = tangent.x;
    tangents[id * 4 + 1] = tangent.y;
    tangents[id * 4 + 2] = tangent.z;
    return id;
  };
  // Differentiate the actual height field, independently of cap triangulation.
  // Thin Earcut triangles must not decide where a rounded shoulder has a crease.
  const flatMargin = Math.max(0.35, ...layout.extensions.map((e) => e.blend)) * 0.35 + 0.03;
  const gradient = (x: number, y: number, up: boolean) => {
    // The landing and the central back are exactly planar. Avoid four field
    // evaluations per vertex there; only the shoulder and roots need derivatives.
    if (
      layout.body(x, y) < -Math.max(flatMargin, up ? c * 1.5 + 0.03 : 0) &&
      (up || !layout.nearPocket(x, y))
    )
      return { x: 0, y: 0 };
    const eps = 0.015,
      key = up ? 'top' : 'bottom';
    return {
      x: (layout.section(x + eps, y)[key] - layout.section(x - eps, y)[key]) / (2 * eps),
      y: (layout.section(x, y + eps)[key] - layout.section(x, y - eps)[key]) / (2 * eps),
    };
  };
  const capNormal = (x: number, y: number, up: boolean) => {
    const g = gradient(x, y, up);
    return new THREE.Vector3(-g.x, -g.y, 1).normalize().multiplyScalar(up ? 1 : -1);
  };
  const triangle = (a: number, b: number, c: number, surface = 0) => {
    indices.push(a, b, c);
    surfaces.push(surface);
  };
  /** Concentric bands with fewer vertices towards the centre replace the long
   * centre fan. Every boundary edge is consumed exactly once, including corners. */
  const fillDisk = (
    boundary: number[],
    radiusAt: (angle: number, scale: number) => number,
    base: number,
    z: number,
    up: boolean,
  ) => {
    const emit = (a: number, b: number, c: number) => (up ? triangle(a, b, c) : triangle(a, c, b));
    const sorted = (row: number[]) =>
      row
        .map((id) => ({
          id,
          angle:
            (Math.atan2(positions[id * 3 + 1]!, positions[id * 3]!) + Math.PI * 2) % (Math.PI * 2),
        }))
        .sort((a, b) => a.angle - b.angle);
    let outer = sorted(boundary);
    const spacing = Math.max(0.8, R / 16);
    for (let radius = base - spacing; radius > spacing * 0.65; radius -= spacing) {
      const count = Math.max(8, Math.ceil((Math.PI * 2 * radius) / spacing));
      const inner = Array.from({ length: count }, (_, i) => {
        const angle = (i * Math.PI * 2) / count,
          r = radiusAt(angle, radius / base);
        return {
          angle,
          id: setNormal(
            vertex(r * Math.cos(angle), r * Math.sin(angle), z),
            new THREE.Vector3(0, 0, up ? 1 : -1),
          ),
        };
      });
      let i = 0,
        j = 0;
      while (i < outer.length || j < inner.length) {
        const a = outer[i % outer.length]!.id,
          b = inner[j % inner.length]!.id;
        const nextOuter =
          i >= outer.length ? Infinity : i + 1 === outer.length ? Math.PI * 2 : outer[i + 1]!.angle;
        const nextInner =
          j >= inner.length ? Infinity : j + 1 === inner.length ? Math.PI * 2 : inner[j + 1]!.angle;
        if (nextOuter <= nextInner) {
          emit(a, outer[(i + 1) % outer.length]!.id, b);
          i++;
        } else {
          emit(a, inner[(j + 1) % inner.length]!.id, b);
          j++;
        }
      }
      outer = inner;
    }
    const center = setNormal(vertex(0, 0, z), new THREE.Vector3(0, 0, up ? 1 : -1));
    for (let i = 0; i < outer.length; i++)
      emit(center, outer[i]!.id, outer[(i + 1) % outer.length]!.id);
  };
  const details = outline.map((p) => ({ ...p, ...layout.section(p.x, p.y) }));
  // A swept edge cannot be wider than the local contour's bend. Limit its
  // radius locally and ease that limit into its neighbours, rather than letting
  // the underside fold across a tight tip or concave attachment root.
  for (let i = 0; i < details.length; i++) {
    const p = details[i]!;
    for (const q of [
      details[(i + details.length - 1) % details.length]!,
      details[(i + 1) % details.length]!,
    ]) {
      const turn = Math.acos(clamp(p.nx * q.nx + p.ny * q.ny, -1, 1));
      if (turn > 1e-5)
        p.bevel = Math.min(p.bevel, (Math.hypot(p.x - q.x, p.y - q.y) / turn) * 0.38);
    }
  }
  for (let pass = 0; pass < 8; pass++)
    for (let i = 0; i < details.length; i++) {
      const p = details[i]!;
      for (const q of [
        details[(i + details.length - 1) % details.length]!,
        details[(i + 1) % details.length]!,
      ])
        p.bevel = Math.min(p.bevel, q.bevel + Math.hypot(p.x - q.x, p.y - q.y) * 0.25);
    }
  // Shared section: bottom edge, flank (flat/bombed), top edge. Flat chamfers and
  // rounded breaks have the same endpoints, so style changes preserve the dimensions.
  const rings: { inset: number; height: number; t: number; region: 'bottom' | 'flank' | 'top' }[] =
    [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    rings.push({
      t,
      inset: rounded ? 1 - Math.sin((t * Math.PI) / 2) : 1 - t,
      height: rounded ? 1 - Math.cos((t * Math.PI) / 2) : t,
      region: 'bottom',
    });
  }
  // The flank is a straight ruled surface: intermediate rows add no shape.
  rings.push({ inset: 0, height: 1, t: 1, region: 'flank' });
  for (let i = 1; i <= 6; i++) {
    const t = i / 6;
    rings.push({
      t,
      inset: rounded ? 1 - Math.cos((t * Math.PI) / 2) : t,
      height: rounded ? Math.sin((t * Math.PI) / 2) : t,
      region: 'top',
    });
  }
  const rowIds: number[][] = [];
  let perimeter = 0;
  for (const ring of rings) {
    perimeter = 0;
    rowIds.push(
      details.map((p, i) => {
        const previous = details[(i + details.length - 1) % details.length]!;
        perimeter += Math.hypot(p.x - previous.x, p.y - previous.y);
        const inset = ring.inset * p.bevel;
        let z: number;
        const x = p.x - p.nx * inset,
          y = p.y - p.ny * inset;
        const actual = layout.section(x, y);
        if (ring.region === 'bottom') z = actual.bottom + ring.height * p.bevel;
        else if (ring.region === 'top') z = actual.top - p.bevel + ring.height * p.bevel;
        else z = mix(actual.bottom + p.bevel, actual.top - p.bevel, ring.height);
        return vertex(x, y, z, perimeter / 12, z / 12);
      }),
    );
  }
  const rowPoint = (row: number, i: number) =>
    new THREE.Vector3().fromArray(positions, rowIds[row]![i]! * 3);
  const sweepNormal = (row: number, i: number, region: 'bottom' | 'flank' | 'top') => {
    const ring = rings[row]!,
      p = details[i]!,
      count = details.length;
    const point = rowPoint(row, i),
      previous = rowPoint(row, (i + count - 1) % count),
      next = rowPoint(row, (i + 1) % count);
    const before = point.clone().sub(previous),
      after = next.sub(point);
    const a = before.length(),
      b = after.length();
    const tangent = before
      .multiplyScalar(b / (a * (a + b)))
      .add(after.multiplyScalar(a / (b * (a + b))));
    let across = new THREE.Vector3(0, 0, 1);
    if (region !== 'flank') {
      const top = region === 'top';
      // At a chamfer boundary the adjacent regions intentionally keep separate
      // normals; a round edge instead meets the cap and flank tangentially.
      const t = ring.region === region ? ring.t : top ? 0 : 1;
      const angle = (t * Math.PI) / 2;
      const inward = top ? (rounded ? -Math.sin(angle) : -1) : rounded ? Math.cos(angle) : 1;
      const vertical = rounded ? (top ? Math.cos(angle) : Math.sin(angle)) : 1;
      const g = gradient(point.x, point.y, top);
      across = new THREE.Vector3(
        p.nx * inward,
        p.ny * inward,
        vertical + (g.x * p.nx + g.y * p.ny) * inward,
      );
    }
    const normal = tangent.clone().cross(across).normalize();
    return { normal, tangent: tangent.normalize() };
  };
  const sideIds = new Map<string, number>();
  const sideVertex = (row: number, i: number, region: 'bottom' | 'flank' | 'top', wrap = false) => {
    const original = rowIds[row]![i]!;
    const key = `${row}:${i}:${rounded ? 'smooth' : region}:${wrap}`;
    const cached = sideIds.get(key);
    if (cached !== undefined) return cached;
    const id =
      rounded && !wrap
        ? original
        : vertex(
            positions[original * 3]!,
            positions[original * 3 + 1]!,
            positions[original * 3 + 2]!,
            uvs[original * 2]! + (wrap ? perimeter / 12 : 0),
            uvs[original * 2 + 1]!,
          );
    const frame = sweepNormal(row, i, region);
    setNormal(id, frame.normal);
    tangents[id * 4] = frame.tangent.x;
    tangents[id * 4 + 1] = frame.tangent.y;
    tangents[id * 4 + 2] = frame.tangent.z;
    sideIds.set(key, id);
    return id;
  };
  for (let j = 1; j < rowIds.length; j++)
    for (let i = 0; i < outline.length; i++) {
      const next = (i + 1) % outline.length;
      const region = rings[j]!.region;
      const a = sideVertex(j - 1, i, region),
        b = sideVertex(j - 1, next, region, next === 0),
        cc = sideVertex(j, next, region, next === 0),
        dd = sideVertex(j, i, region);
      const surface = rings[j]!.region === 'flank' ? 0 : 1;
      triangle(a, b, cc, surface);
      triangle(a, cc, dd, surface);
    }
  const hole = simplifyLoop(
    Array.from({ length: 192 }, (_, i) => {
      const angle = (i * Math.PI * 2) / 192;
      const r = (d.openingRadius + 0.04) * d.dialScale * shapeRadius(d.dialShape, angle);
      return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
    }),
    R * 0.0004,
  );
  const cap = (row: number[], top: boolean, topHole = hole) => {
    const outer = row.map((id) => ({
      x: Math.fround(positions[id * 3]!),
      y: Math.fround(positions[id * 3 + 1]!),
    }));
    let capHole = (
      top
        ? topHole
        : simplifyLoop(
            Array.from({ length: 192 }, (_, i) => {
              const angle = (i * Math.PI * 2) / 192,
                radius = R * 0.65 * shapeRadius(config.case.shape, angle);
              return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
            }),
            R * 0.0004,
          )
    ).map((p) => ({ x: Math.fround(p.x), y: Math.fround(p.y) }));
    if (!top) {
      const dense: Point[] = [];
      for (let i = 0; i < capHole.length; i++) {
        const a = capHole[i]!,
          b = capHole[(i + 1) % capHole.length]!,
          length = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.ceil(length / Math.max(0.8, R / 18));
        for (let j = 0; j < steps; j++) {
          const t = j / steps;
          dense.push({
            x: Math.fround(mix(a.x, b.x, t)),
            y: Math.fround(mix(a.y, b.y, t)),
          });
        }
      }
      capHole = dense;
    }
    const points = [...outer, ...capHole];
    // Earcut clips zero-area ears along runs of aligned vertices (straight walls
    // between lugs). Triangulate without the interior vertices of such runs; the
    // boundary restoration below fans them back from a vertex off the line.
    const kept = outer
      .map((p, i) => {
        const a = outer[(i + outer.length - 1) % outer.length]!,
          b = outer[(i + 1) % outer.length]!;
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        const offset = Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / length;
        return offset > length * 1e-4 ? i : -1;
      })
      .filter((i) => i >= 0);
    let raw = THREE.ShapeUtils.triangulateShape(
      kept.map((i) => new THREE.Vector2(outer[i]!.x, outer[i]!.y)),
      [capHole.map((p) => new THREE.Vector2(p.x, p.y))],
    ).map((face) =>
      face.map((index) =>
        index < kept.length ? kept[index]! : index - kept.length + outer.length,
      ),
    );
    raw = restoreBoundaryVertices(raw, [
      outer.map((_, i) => i),
      capHole.map((_, i) => i + outer.length),
    ]);
    raw = splitCollinearSlivers(points, raw);
    const boundary = new Set<number>();
    for (let i = 0; i < outer.length; i++) boundary.add(edgeKey(i, (i + 1) % outer.length));
    for (let i = 0; i < capHole.length; i++)
      boundary.add(edgeKey(outer.length + i, outer.length + ((i + 1) % capHole.length)));
    const meshStep = top ? Math.max(1, R / 12) : Math.max(1.2, R / 12);
    raw = improveFaces(points, raw, boundary);
    let faces = refine(
      points,
      raw,
      meshStep,
      boundary,
      false,
      top
        ? (p) => layout.section(p.x, p.y).top
        : layout.pocket
          ? (p) => layout.section(p.x, p.y).bottom
          : undefined,
      !top && layout.pocket ? 0.15 : 0.18,
      !top && !!layout.pocket,
    );
    // Use the GPU's actual coordinates for the final flips and winding checks.
    // Rounding a nearly collinear ear afterwards can invert a microscopic face.
    for (const point of points) {
      point.x = Math.fround(point.x);
      point.y = Math.fround(point.y);
    }
    // Flips only look at the plan: around a pocket, a long flipped edge would reach
    // from the flat back up the wall and smear its shading. Keep those flips local.
    faces = improveFaces(points, faces, boundary, !top && layout.pocket ? 0.3 : meshStep * 1.2);
    faces = collapseShortEdges(points, faces, outer.length + capHole.length);
    const ids = points.map((p, i) =>
      i < row.length
        ? vertex(p.x, p.y, positions[row[i]! * 3 + 2]!)
        : vertex(p.x, p.y, top ? layout.section(p.x, p.y).top : layout.section(p.x, p.y).bottom),
    );
    for (let i = 0; i < ids.length; i++)
      setNormal(ids[i]!, capNormal(points[i]!.x, points[i]!.y, top));
    for (const [a, b, cc] of faces as [number, number, number][]) {
      const p = points[a]!,
        q = points[b]!,
        r = points[cc]!;
      const positive = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x) > 0;
      if (positive === top) triangle(ids[a]!, ids[b]!, ids[cc]!);
      else triangle(ids[a]!, ids[cc]!, ids[b]!);
    }
    return ids.slice(outer.length, outer.length + capHole.length);
  };
  const backRing = cap(rowIds[0]!, false);
  fillDisk(
    backRing,
    (angle, scale) => R * 0.65 * shapeRadius(config.case.shape, angle) * scale,
    R * 0.65,
    d.z.back,
    false,
  );
  // The exterior deck is tessellated against a fixed landing contour. Only the
  // inner annulus changes with the aperture: dial size cannot move lug surfaces
  // or change the triangulation of the case's exterior.
  const landing = simplifyLoop(
    Array.from({ length: 192 }, (_, i) => {
      const angle = (i * Math.PI * 2) / 192,
        radius = R * shapeRadius(config.case.shape, angle) - c * 1.5;
      return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    }),
    R * 0.0004,
  );
  const landingIds = cap(rowIds[rowIds.length - 1]!, true, landing);
  const innerTop = cap(landingIds, true);
  const floor = d.z.back + Math.min(0.55, d.caseThickness * 0.08);
  const innerWallTop = innerTop.map((id) =>
    vertex(positions[id * 3]!, positions[id * 3 + 1]!, positions[id * 3 + 2]!),
  );
  const innerBottom = hole.map((p) => vertex(p.x, p.y, floor));
  for (let i = 0; i < hole.length; i++) {
    const previous = hole[(i + hole.length - 1) % hole.length]!,
      next = hole[(i + 1) % hole.length]!;
    const n = new THREE.Vector3(-(next.y - previous.y), next.x - previous.x, 0).normalize();
    setNormal(innerWallTop[i]!, n);
    setNormal(innerBottom[i]!, n);
  }
  for (let i = 0; i < hole.length; i++) {
    const next = (i + 1) % hole.length;
    triangle(innerWallTop[i]!, innerWallTop[next]!, innerBottom[next]!);
    triangle(innerWallTop[i]!, innerBottom[next]!, innerBottom[i]!);
  }
  fillDisk(
    innerBottom.map((id) =>
      setNormal(
        vertex(positions[id * 3]!, positions[id * 3 + 1]!, positions[id * 3 + 2]!),
        new THREE.Vector3(0, 0, 1),
      ),
    ),
    (angle, scale) =>
      (d.openingRadius + 0.04) * d.dialScale * shapeRadius(d.dialShape, angle) * scale,
    d.openingRadius,
    floor,
    true,
  );
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  indexed.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  indexed.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  indexed.setAttribute('tangent', new THREE.Float32BufferAttribute(tangents, 4));
  indexed.setIndex(indices);
  const geometry = indexed;
  // Partition AFTER normals have been computed, so lighting cannot reveal the render-layer seams.
  const buckets = new Map<
    string,
    {
      part: Part;
      surface: number;
      position: number[];
      normal: number[];
      tangent: number[];
      uv: number[];
      indices: number[];
      vertices: Map<number, number>;
    }
  >();
  const p = geometry.getAttribute('position'),
    n = geometry.getAttribute('normal'),
    uv = geometry.getAttribute('uv'),
    t = geometry.getAttribute('tangent');
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i]!,
      b = indices[i + 1]!,
      c = indices[i + 2]!;
    const x = (p.getX(a) + p.getX(b) + p.getX(c)) / 3;
    const y = (p.getY(a) + p.getY(b) + p.getY(c)) / 3;
    let part = layout.section(x, y).part;
    // The broad underside is shared with the case. A triangle reaching into the
    // aperture's projection belongs to that case layer, even if its centroid is
    // near a lug. This keeps isolated lug previews clear of the glass opening.
    if (part === 'lugs')
      for (let k = i; k < i + 3; k++) {
        const id = indices[k]!;
        const px = p.getX(id),
          py = p.getY(id),
          angle = Math.atan2(py, px);
        if (
          Math.hypot(px, py) <
          (d.openingRadius + 0.35) * d.dialScale * shapeRadius(d.dialShape, angle)
        )
          part = 'case';
      }
    const surface = surfaces[i / 3]!;
    const key = `${part}:${surface}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        part,
        surface,
        position: [],
        normal: [],
        tangent: [],
        uv: [],
        indices: [],
        vertices: new Map(),
      };
      buckets.set(key, bucket);
    }
    for (let k = i; k < i + 3; k++) {
      const source = indices[k]!;
      let target = bucket.vertices.get(source);
      if (target === undefined) {
        target = bucket.position.length / 3;
        bucket.vertices.set(source, target);
        bucket.position.push(p.getX(source), p.getY(source), p.getZ(source));
        bucket.normal.push(n.getX(source), n.getY(source), n.getZ(source));
        bucket.tangent.push(t.getX(source), t.getY(source), t.getZ(source), t.getW(source));
        bucket.uv.push(uv.getX(source), uv.getY(source));
      }
      bucket.indices.push(target);
    }
  }
  geometry.dispose();
  const meshes: EnvelopeMeshData[] = [];
  for (const bucket of buckets.values()) {
    // Same index width as BufferGeometry.setIndex would choose for a plain array.
    const wide = bucket.indices.some((v) => v >= 65535);
    meshes.push({
      part: bucket.part,
      name: bucket.surface ? 'envelope-edge' : 'envelope-surface',
      position: new Float32Array(bucket.position),
      normal: new Float32Array(bucket.normal),
      tangent: new Float32Array(bucket.tangent),
      uv: new Float32Array(bucket.uv),
      index: wide ? new Uint32Array(bucket.indices) : new Uint16Array(bucket.indices),
    });
  }
  let drilling: EnvelopeData['drilling'] = null;
  if (settings.drilled && settings.attachment === 'lugs') {
    const l = lugLayout(config, d, config.case.shape === 'cushion');
    drilling = { radius: l.barRadius, length: l.thickness + 0.02, positions: [] };
    for (const sx of [1, -1])
      for (const sy of [1, -1])
        drilling.positions.push([
          sx * (d.lugWidth / 2 + l.thickness / 2),
          sy * l.barY,
          l.barZ(l.barY),
        ]);
  }
  return { key, meshes, drilling };
}
