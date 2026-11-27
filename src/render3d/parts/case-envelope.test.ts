import * as THREE from 'three';
import { expect, it } from 'vitest';
import { defaultConfig } from '../../core/config/defaults';
import { CASE_SHAPES } from '../../core/geometry/case-shape';
import { proportionsForDiameter, watchDimensions } from '../../core/geometry/dimensions';
import { MaterialLibrary } from '../materials';
import { buildCaseEnvelope } from './case-envelope';
import { LUG_STYLES, lugLayout, strapSeat } from './lugs';
import { buildWatch } from '../watch';

function dispose(envelope: { case: THREE.Group; lugs: THREE.Group }) {
  const geometries = new Set<THREE.BufferGeometry>();
  for (const group of Object.values(envelope))
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) geometries.add(o.geometry);
    });
  geometries.forEach((g) => g.dispose());
}

it.each(CASE_SHAPES)(
  '%s: the envelope is closed, connected and has no internal duplicate faces',
  (shape) => {
    const lib = new MaterialLibrary();
    for (const [profile, join, diameter, style, position] of [
      ['straight', 'detached', 22, 'straight', '2h'],
      ['curved', 'blended', 48, 'curved', '4h'],
      ['straight', 'blended', 40, 'faceted', '3h'],
      ['curved', 'detached', 40, 'integrated', '3h'],
    ] as const) {
      const config = defaultConfig();
      Object.assign(config.case, proportionsForDiameter(diameter), {
        shape,
        profile,
        lugJoin: join,
        lugs: style,
      });
      config.dial.shape = shape;
      Object.assign(config.crown, { guard: true, position });
      const envelope = buildCaseEnvelope(config, watchDimensions(config), lib);
      const edges = new Map<string, number>();
      const faces = new Set<string>();
      const graph = new Map<string, Set<string>>();
      let degenerate = 0,
        duplicate = 0;
      for (const group of Object.values(envelope))
        group.traverse((o: THREE.Object3D) => {
          if (!(o instanceof THREE.Mesh)) return;
          for (const name of ['position', 'normal', 'tangent', 'uv'])
            expect(o.geometry.getAttribute(name).array.every(Number.isFinite)).toBe(true);
          const expanded = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
          const p = expanded.getAttribute('position');
          const a = new THREE.Vector3(),
            b = new THREE.Vector3(),
            c = new THREE.Vector3();
          const key = (i: number) =>
            [p.getX(i), p.getY(i), p.getZ(i)].map((v) => Math.round(v * 1e5)).join(',');
          for (let i = 0; i < p.count; i += 3) {
            a.fromBufferAttribute(p, i);
            b.fromBufferAttribute(p, i + 1);
            c.fromBufferAttribute(p, i + 2);
            if (b.sub(a).cross(c.sub(a)).lengthSq() < 1e-16) degenerate++;
            const vertices = [key(i), key(i + 1), key(i + 2)];
            const face = [...vertices].sort().join('|');
            if (faces.has(face)) duplicate++;
            faces.add(face);
            for (let j = 0; j < 3; j++) {
              const from = vertices[j]!,
                to = vertices[(j + 1) % 3]!;
              const edge = [from, to].sort().join('|');
              edges.set(edge, (edges.get(edge) ?? 0) + 1);
              if (!graph.has(from)) graph.set(from, new Set());
              graph.get(from)!.add(to);
            }
          }
          if (expanded !== o.geometry) expanded.dispose();
        });
      const context = `${shape}/${profile}/${join}/${diameter}/${style}`;
      expect(degenerate, context).toBe(0);
      expect(duplicate, context).toBe(0);
      expect([...edges.values()].filter((n) => n !== 2).length, context).toBe(0);
      const seen = new Set<string>(),
        pending = [graph.keys().next().value!];
      while (pending.length) {
        const p = pending.pop()!;
        if (seen.has(p)) continue;
        seen.add(p);
        pending.push(...graph.get(p)!);
      }
      expect(seen.size, context).toBe(graph.size);
      dispose(envelope);
    }
    lib.dispose();
  },
  30_000,
);

it('keeps the bezel, aperture and hands dimensions independent of the lug connection and guards', () => {
  const config = defaultConfig();
  const reference = watchDimensions(config);
  for (const join of ['detached', 'flush', 'blended'] as const)
    for (const guard of [false, true]) {
      Object.assign(config.case, { lugJoin: join });
      config.crown.guard = guard;
      expect(watchDimensions(config)).toEqual(reference);
    }
});

it('keeps the spring-bar seat inside every ordinary lug style in the actual envelope', () => {
  const lib = new MaterialLibrary();
  const ray = new THREE.Raycaster();
  for (const style of LUG_STYLES.filter((s) => !['integrated', 'none'].includes(s)))
    for (const join of ['detached', 'blended'] as const) {
      const config = defaultConfig();
      Object.assign(config.case, { lugs: style, lugJoin: join });
      const d = watchDimensions(config),
        seat = strapSeat(config, d)!,
        l = lugLayout(config, d, false);
      const envelope = buildCaseEnvelope(config, d, lib);
      const root = new THREE.Group();
      root.add(envelope.case, envelope.lugs);
      root.updateMatrixWorld(true);
      const x = d.lugWidth / 2 + d.lugThickness * 0.5;
      ray.set(new THREE.Vector3(x, seat.y, 30), new THREE.Vector3(0, 0, -1));
      const top = ray.intersectObject(root, true)[0];
      ray.set(new THREE.Vector3(x, seat.y, -30), new THREE.Vector3(0, 0, 1));
      const bottom = ray.intersectObject(root, true)[0];
      expect(top, `${style}/${join}`).toBeDefined();
      expect(bottom, `${style}/${join}`).toBeDefined();
      expect(top!.point.z - seat.z, `${style}/${join}`).toBeGreaterThan(l.barRadius);
      expect(seat.z - bottom!.point.z, `${style}/${join}`).toBeGreaterThan(l.barRadius);
      dispose(envelope);
    }
  lib.dispose();
}, 15_000);

it('attaches guards to the case layer and keeps cached watches independently disposable', () => {
  const config = defaultConfig();
  config.crown.guard = true;
  const lib = new MaterialLibrary();
  const first = buildWatch(config, lib, { quality: 'fallback', layers: ['case', 'lugs', 'crown'] });
  const second = buildWatch(config, lib, {
    quality: 'fallback',
    layers: ['case', 'lugs', 'crown'],
  });
  const a = first.layers.case.children[0] as THREE.Mesh,
    b = second.layers.case.children[0] as THREE.Mesh;
  expect(a.geometry).not.toBe(b.geometry);
  expect(a.geometry.getAttribute('position').array).toEqual(
    b.geometry.getAttribute('position').array,
  );
  expect(first.layers.crown.children.every((o) => !(o instanceof THREE.Mesh))).toBe(true);
  first.dispose();
  second.dispose();
  lib.dispose();
});

it.each(['round', 'rectangle'])(
  '%s: a wide imported strap retains its bar spacing and a connected root',
  (shape) => {
    const config = defaultConfig();
    Object.assign(config.case, {
      shape,
      diameterMm: 22,
      lugWidthMm: 30,
      lugToLugMm: 35,
      lugJoin: 'blended',
    });
    const lib = new MaterialLibrary(),
      d = watchDimensions(config);
    const envelope = buildCaseEnvelope(config, d, lib);
    expect(envelope.lugs.children.length).toBeGreaterThan(0);
    const layout = lugLayout(config, d, false);
    expect(layout.aIn).toBe(15);
    for (const group of Object.values(envelope))
      group.traverse((o: THREE.Object3D) => {
        if (o instanceof THREE.Mesh)
          for (const name of ['position', 'normal', 'tangent'])
            expect(o.geometry.getAttribute(name).array.every(Number.isFinite)).toBe(true);
      });
    dispose(envelope);
    lib.dispose();
  },
);

it('shares one envelope across crown head designs, but not across guards', () => {
  const lib = new MaterialLibrary();
  const signature = (envelope: { case: THREE.Group; lugs: THREE.Group }) => {
    const arrays: number[][] = [];
    for (const group of Object.values(envelope))
      group.traverse((o) => {
        if (o instanceof THREE.Mesh)
          arrays.push(Array.from(o.geometry.getAttribute('position').array));
      });
    return arrays;
  };
  const build = (style: string, guard: boolean) => {
    const config = defaultConfig();
    Object.assign(config.crown, { style, guard });
    // A drawing no other test builds, so the first call is a genuine cache miss.
    config.case.construction = { ...config.case.construction!, dome: 0.4321 };
    const envelope = buildCaseEnvelope(config, watchDimensions(config), lib);
    const result = signature(envelope);
    dispose(envelope);
    return result;
  };
  const timed = (style: string, guard: boolean) => {
    const start = performance.now();
    return { result: build(style, guard), ms: performance.now() - start };
  };
  const { result: onion, ms: miss } = timed('onion', false);
  const { result: pump, ms: hit } = timed('pump', false);
  // A cache hit only clones the template: relative timing stays meaningful under load.
  expect(hit).toBeLessThan(miss / 3);
  expect(pump).toEqual(onion);
  expect(build('onion', true)).not.toEqual(onion);
  lib.dispose();
});
