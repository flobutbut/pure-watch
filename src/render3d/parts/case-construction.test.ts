import * as THREE from 'three';
import { expect, it } from 'vitest';
import { defaultConfig } from '../../core/config/defaults';
import { caseDraft } from '../../core/config/case-construction';
import { withCaseDraft } from '../../core/config/case-dimensions';
import { watchDimensions } from '../../core/geometry/dimensions';
import { MaterialLibrary } from '../materials';
import { buildCaseEnvelope, caseEnvelopeLayout } from './case-envelope';
import { strapPocket, strapSeat, lugLayout, surfaceY } from './lugs';
import { shapeRadius } from '../../core/geometry/case-shape';
import { buildStrap } from './strap';
import { bezelOutline, caseDeckTop, caseLevels } from './levels';
import { buildWatch } from '../watch';
import { bezelRingWidth } from './independent-bezel';

it.each(['round', 'cushion', 'tonneau', 'square', 'rectangle', 'octagon'])(
  '%s: the shared construction stays closed with a clean back and changing curvature',
  (shape) => {
    const lib = new MaterialLibrary();
    for (const amount of [0, 1]) {
      const base = defaultConfig();
      base.case.shape = shape;
      const draft = caseDraft(base);
      Object.assign(draft.construction, {
        dome: amount,
        integration: amount,
        edge: amount ? 'rounded' : 'chamfer',
        taper: 0.4,
        swell: 0.3,
      });
      draft.crownGuard = true;
      const config = withCaseDraft(base, draft),
        d = watchDimensions(config),
        shell = buildCaseEnvelope(config, d, lib);
      const edges = new Map<string, number>();
      let back = 0,
        degenerate = 0,
        maxRearEdge = 0;
      for (const group of Object.values(shell))
        group.traverse((o: THREE.Object3D) => {
          if (!(o instanceof THREE.Mesh)) return;
          const expanded = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
          const p = expanded.getAttribute('position');
          for (const attr of ['position', 'normal', 'tangent'])
            expect(o.geometry.getAttribute(attr).array.every(Number.isFinite)).toBe(true);
          for (let i = 0; i < p.count; i += 3) {
            const a = new THREE.Vector3().fromBufferAttribute(p, i),
              b = new THREE.Vector3().fromBufferAttribute(p, i + 1),
              c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
            const area = b.clone().sub(a).cross(c.clone().sub(a));
            if (area.lengthSq() < 1e-16) degenerate++;
            const keys = [a, b, c].map((v) =>
              v
                .toArray()
                .map((n) => Math.round(n * 1e5))
                .join(','),
            );
            for (let j = 0; j < 3; j++) {
              const key = [keys[j], keys[(j + 1) % 3]].sort().join('|');
              edges.set(key, (edges.get(key) ?? 0) + 1);
            }
            if ([a, b, c].every((v) => Math.abs(v.z - d.z.back) < 1e-4)) {
              back++;
              expect(area.z).toBeLessThan(0);
              maxRearEdge = Math.max(
                maxRearEdge,
                a.distanceTo(b),
                b.distanceTo(c),
                c.distanceTo(a),
              );
            }
          }
          if (expanded !== o.geometry) expanded.dispose();
          o.geometry.dispose();
        });
      expect(degenerate).toBe(0);
      expect(
        [...edges.values()].filter((v) => v !== 2),
        `${shape}/${amount}: ${JSON.stringify([...edges].filter(([, n]) => n !== 2).slice(0, 6))}`,
      ).toHaveLength(0);
      expect(back).toBeGreaterThan(200);
      expect(maxRearEdge).toBeLessThan(d.caseRadius * 0.35);
      const seat = strapSeat(config, d)!;
      const sample = caseEnvelopeLayout(config, d).section(
        d.lugWidth / 2 + draft.construction.lugWidthMm * 0.5,
        seat.y,
      );
      expect(seat.z).toBeGreaterThan(sample.bottom);
      expect(seat.z).toBeLessThan(sample.top);
    }
    lib.dispose();
  },
  30_000,
);

it('curves the upper shoulder while keeping the bezel landing and dimensions fixed', () => {
  const config = defaultConfig(),
    draft = caseDraft(config),
    d = watchDimensions(config);
  draft.construction.dome = 0;
  const flat = caseEnvelopeLayout(withCaseDraft(config, draft), d);
  draft.construction.dome = 1;
  const curved = caseEnvelopeLayout(withCaseDraft(config, draft), d);
  expect(curved.section(0, d.caseRadius - 0.1).top).toBeLessThan(
    flat.section(0, d.caseRadius - 0.1).top - 0.5,
  );
  expect(curved.section(d.openingRadius, 0).top).toBeCloseTo(
    flat.section(d.openingRadius, 0).top,
    6,
  );
  expect(watchDimensions(withCaseDraft(config, draft))).toEqual(d);
});

it('keeps the connection continuous at zero and the spring bar at the same distance', () => {
  const config = defaultConfig(),
    draft = caseDraft(config),
    d = watchDimensions(config);
  draft.construction.integration = 0;
  const first = withCaseDraft(config, draft),
    a = caseEnvelopeLayout(first, d),
    seatA = strapSeat(first, d)!;
  draft.construction.integration = 0.0001;
  const second = withCaseDraft(config, draft),
    b = caseEnvelopeLayout(second, d),
    seatB = strapSeat(second, d)!;
  expect(seatB.y).toBeCloseTo(seatA.y, 8);
  expect(Math.abs(seatB.z - seatA.z)).toBeLessThan(0.001);
  expect(Math.abs(b.section(12, 19).top - a.section(12, 19).top)).toBeLessThan(0.001);
});

it('keeps the solid attachment symmetric with taper and fullness', () => {
  const config = defaultConfig(),
    draft = caseDraft(config);
  Object.assign(draft.construction, { attachment: 'block', taper: 0.8, swell: 0.7 });
  const next = withCaseDraft(config, draft),
    layout = caseEnvelopeLayout(next, watchDimensions(next));
  for (const y of [19, 21, 23])
    for (const x of [8, 10, 12])
      expect(layout.distance(x, y)).toBeCloseTo(layout.distance(-x, y), 6);
});

it('keeps both surfaces flat when their guide endpoints share the case planes', () => {
  const config = defaultConfig(),
    draft = caseDraft(config);
  Object.assign(draft.construction, {
    dome: 0,
    underside: 'flat',
    tipThicknessMm: caseDeckTop(watchDimensions(config)) - watchDimensions(config).z.back,
    integration: 1,
  });
  const next = withCaseDraft(config, draft),
    d = watchDimensions(next),
    layout = lugLayout(next, d, false);
  for (const y of [layout.profileStart, layout.barY, layout.yTip])
    expect(layout.profile(y).top).toBeCloseTo(caseDeckTop(d), 8);
});

it.each(['2h', '3h', '4h'])(
  'shares root integration with guards at %s, including without lugs',
  (position) => {
    const base = defaultConfig(),
      draft = caseDraft(base);
    draft.construction.attachment = 'none';
    base.crown.position = position;
    const layouts = [0, 1].map((integration) => {
      const next = withCaseDraft(base, {
        ...draft,
        crownGuard: true,
        construction: { ...draft.construction, integration },
      });
      return caseEnvelopeLayout(next, watchDimensions(next));
    });
    const guards = layouts.map((layout) => layout.extensions[0]!);
    expect(guards[1]!.tip).toBe(guards[0]!.tip);
    expect(guards[1]!.inner).toBe(guards[0]!.inner);
    let change = 0;
    for (let x = -25; x <= 25; x += 0.5)
      for (let y = -25; y <= 25; y += 0.5)
        change = Math.max(change, layouts[0]!.distance(x, y) - layouts[1]!.distance(x, y));
    expect(change).toBeGreaterThan(0.15);
    const d = watchDimensions(base),
      theta = position === '2h' ? Math.PI / 6 : position === '4h' ? -Math.PI / 6 : 0;
    // The channel still leaves space for the head at its free end.
    for (const layout of layouts)
      expect(
        layout.distance(
          (d.caseRadius + d.crown.length) * Math.cos(theta),
          (d.caseRadius + d.crown.length) * Math.sin(theta),
        ),
      ).toBeGreaterThan(0.1);
  },
);

it('uses a continuous shading frame on the reported domed lug shoulders', () => {
  const base = defaultConfig(),
    draft = caseDraft(base);
  Object.assign(draft.construction, {
    dome: 0.81,
    integration: 0.93,
    lugWidthMm: 3.6,
    taper: 0.16,
    tipRound: 0.33,
    underside: 'flat',
    tipThicknessMm: 1.32,
    edge: 'rounded',
    edgeSizeMm: 0.5,
  });
  const config = withCaseDraft(base, draft),
    d = watchDimensions(config),
    lib = new MaterialLibrary(),
    shell = buildCaseEnvelope(config, d, lib);
  const samples = new Map<string, { normal: THREE.Vector3; tangent: THREE.Vector3 }>();
  let repeated = 0;
  for (const group of Object.values(shell))
    group.traverse((o: THREE.Object3D) => {
      if (!(o instanceof THREE.Mesh)) return;
      const p = o.geometry.getAttribute('position'),
        n = o.geometry.getAttribute('normal'),
        t = o.geometry.getAttribute('tangent');
      const count = o.geometry.index?.count ?? p.count;
      for (let corner = 0; corner < count; corner++) {
        const i = o.geometry.index?.getX(corner) ?? corner;
        const normal = new THREE.Vector3().fromBufferAttribute(n, i),
          tangent = new THREE.Vector3().fromBufferAttribute(t, i);
        expect(normal.length()).toBeCloseTo(1, 5);
        expect(tangent.length()).toBeCloseTo(1, 5);
        expect(Math.abs(normal.dot(tangent))).toBeLessThan(1e-5);
        // Stay on the swept rounded edge; its two triangle fans must agree.
        if (o.name !== 'envelope-edge') continue;
        const key = [p.getX(i), p.getY(i), p.getZ(i)].join(',');
        const previous = samples.get(key);
        if (previous) {
          repeated++;
          expect(previous.normal.dot(normal)).toBeGreaterThan(0.99999);
          expect(previous.tangent.dot(tangent)).toBeGreaterThan(0.99999);
        } else samples.set(key, { normal, tangent });
      }
      o.geometry.dispose();
    });
  expect(repeated).toBeGreaterThan(1000);
  lib.dispose();
});

it('keeps the reported thin, tapered lugs on the actual case-back plane', () => {
  const config = defaultConfig();
  Object.assign(config.case.construction!, {
    dome: 0,
    integration: 1,
    lugWidthMm: 3.6,
    taper: 0.7,
    swell: 0.13,
    tipRound: 0,
    underside: 'flat',
    tipThicknessMm: 1.32,
    tipOffsetMm: -3,
    edge: 'rounded',
    edgeSizeMm: 0.5,
  });
  config.crown.guard = true;
  const d = watchDimensions(config),
    layout = lugLayout(config, d, false),
    lib = new MaterialLibrary();
  const shell = buildCaseEnvelope(config, d, lib),
    root = new THREE.Group();
  root.add(shell.case, shell.lugs);
  root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(),
    x = d.lugWidth / 2 + layout.thickness * 0.25;
  for (const y of [layout.profileStart, layout.barY, layout.yTip - layout.tipRadius - 0.6]) {
    expect(layout.profile(y).bottom).toBe(d.z.back);
    ray.set(new THREE.Vector3(x, y, d.z.back - 20), new THREE.Vector3(0, 0, 1));
    const hit = ray.intersectObject(root, true)[0];
    expect(hit, `underside at ${y}`).toBeDefined();
    expect(hit!.point.z).toBeCloseTo(d.z.back, 5);
  }
  for (const guide of [layout.topGuide, layout.bottomGuide]) {
    expect(guide.at(guide.start).slope).toBeCloseTo(0, 8);
    expect(guide.at(guide.start).curvature).toBeCloseTo(0, 8);
    expect(guide.at(guide.end).curvature).toBeCloseTo(0, 8);
  }
  expect(layout.bottomGuide.at(layout.yTip).slope).toBeCloseTo(0, 8);
  expect(layout.topGuide.at(layout.yTip).slope).toBeLessThan(0);
  for (const group of Object.values(shell))
    group.traverse((o: THREE.Object3D) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  lib.dispose();
});

it('changes the underside height independently of the tip thickness and root recess', () => {
  const config = defaultConfig();
  Object.assign(config.case.construction!, {
    underside: 'curved',
    tipOffsetMm: -1.7,
    tipThicknessMm: 1.6,
  });
  const d = watchDimensions(config);
  for (const integration of [0, 1]) {
    config.case.construction!.integration = integration;
    const layout = lugLayout(config, d, false),
      tip = layout.profile(layout.yTip);
    expect(tip.bottom).toBeCloseTo(d.z.back - 1.7, 8);
    expect(tip.top - tip.bottom).toBeCloseTo(1.6, 8);
    expect(layout.profile(layout.profileStart).bottom).toBeCloseTo(d.z.back, 8);
  }
});

it('continues the reported curved tips downwards instead of flattening like a ski', () => {
  const config = defaultConfig();
  Object.assign(config.case.construction!, {
    dome: 0.69,
    transition: 0.07,
    integration: 1,
    taper: 0.65,
    tipRound: 0.1,
    underside: 'curved',
    tipThicknessMm: 1.5,
    tipOffsetMm: -3.9,
    edge: 'sharp',
  });
  const layout = lugLayout(config, watchDimensions(config), false);
  for (const guide of [layout.topGuide, layout.bottomGuide]) {
    expect(guide.at(guide.end).slope).toBeLessThan(-0.2);
    expect(guide.value(guide.end - 0.1)).toBeGreaterThan(guide.value(guide.end));
    expect(guide.at(guide.start).slope).toBeCloseTo(0, 8);
    expect(guide.at(guide.start).curvature).toBeCloseTo(0, 8);
  }
  const tip = layout.profile(layout.yTip);
  expect(tip.top - tip.bottom).toBeCloseTo(1.5, 8);
});

function lugless(shape = 'round') {
  const base = defaultConfig();
  base.case.shape = shape;
  const draft = caseDraft(base);
  draft.lugs = 'none';
  draft.construction = { ...draft.construction, attachment: 'none' };
  const config = withCaseDraft(base, draft);
  return { config, d: watchDimensions(config) };
}

it('carves a strap pocket under a lugless case, and only there', () => {
  const { config, d } = lugless();
  const pocket = strapPocket(config, d)!;
  expect(pocket.height).toBeGreaterThan(3);
  expect(pocket.halfWidth).toBeGreaterThan(d.lugWidth / 2);
  const layout = caseEnvelopeLayout(config, d);
  for (const sign of [1, -1]) {
    const inside = layout.section(0, sign * (pocket.edge - pocket.depth / 2));
    expect(inside.bottom).toBeCloseTo(d.z.back + pocket.height, 6);
    // The flank above the pocket keeps its full height: the edge stays whole.
    expect(inside.top).toBeGreaterThan(inside.bottom + 1);
    expect(layout.section(0, sign * (pocket.back - 1)).bottom).toBe(d.z.back);
    expect(layout.section(pocket.halfWidth + 1, sign * (pocket.edge - 0.8)).bottom).toBe(d.z.back);
  }
  expect(strapPocket(defaultConfig(), watchDimensions(defaultConfig()))).toBeNull();
});

it.each(['round', 'cushion', 'tonneau', 'octagon', 'square', 'rectangle'])(
  '%s: the pocketed envelope stays closed and the strap end sits inside the pocket',
  (shape) => {
    const { config, d } = lugless(shape);
    const pocket = strapPocket(config, d)!;
    const lib = new MaterialLibrary();
    const shell = buildCaseEnvelope(config, d, lib);
    const edges = new Map<string, number>();
    let degenerate = 0;
    for (const group of Object.values(shell))
      group.traverse((o: THREE.Object3D) => {
        if (!(o instanceof THREE.Mesh)) return;
        const expanded = o.geometry.toNonIndexed();
        const p = expanded.getAttribute('position');
        for (let i = 0; i < p.count; i += 3) {
          const v = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(p, i + k));
          if (v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!)).lengthSq() < 1e-16)
            degenerate++;
          const keys = v.map((x) =>
            x
              .toArray()
              .map((n) => Math.round(n * 1e5))
              .join(','),
          );
          for (let j = 0; j < 3; j++) {
            const key = [keys[j], keys[(j + 1) % 3]].sort().join('|');
            edges.set(key, (edges.get(key) ?? 0) + 1);
          }
        }
        expanded.dispose();
        o.geometry.dispose();
      });
    expect(degenerate).toBe(0);
    expect([...edges.values()].filter((n) => n !== 2)).toHaveLength(0);
    // Beneath the case, the strap stays within the pocket: behind its back wall,
    // and below its ceiling.
    const strap = buildStrap(config, d, lib);
    const v = new THREE.Vector3();
    let deepest = Infinity,
      highest = -Infinity,
      exposedCorner = 0;
    const edgeAt = (x: number) =>
      surfaceY(Math.abs(x), (t) => d.caseRadius * shapeRadius(shape, t));
    strap.traverse((o: THREE.Object3D) => {
      if (!(o instanceof THREE.Mesh)) return;
      const p = o.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        // Only the end beneath the case: the strap also passes under the wrist, far below.
        if (Math.abs(v.y) > pocket.edge || v.y < 0 || v.z < d.z.back - 1) continue;
        deepest = Math.min(deepest, v.y);
        highest = Math.max(highest, v.z);
        // The end, corners included, stays at least 1 mm under the case edge, even
        // where round, octagonal and tonneau cases narrow towards 12 o'clock.
        if (v.y < pocket.strapEnd + 0.05)
          exposedCorner = Math.max(exposedCorner, v.y - (edgeAt(v.x) - 1));
      }
      o.geometry.dispose();
    });
    expect(deepest).toBeGreaterThan(pocket.back);
    expect(deepest).toBeLessThan(pocket.edge - pocket.depth / 2);
    expect(highest).toBeLessThan(d.z.back + pocket.height);
    expect(exposedCorner).toBeLessThanOrEqual(0);
    lib.dispose();
  },
  30_000,
);

it.each(['leather', 'metal', 'rubber', 'fabric'])(
  'a %s strap end stays within the pocket of a lugless case',
  (type) => {
    const { config, d } = lugless();
    config.strap = { ...config.strap, type };
    const pocket = strapPocket(config, d)!;
    const lib = new MaterialLibrary(),
      strap = buildStrap(config, d, lib),
      v = new THREE.Vector3();
    let deepest = Infinity,
      highest = -Infinity;
    strap.updateMatrixWorld(true);
    strap.traverse((o: THREE.Object3D) => {
      if (!(o instanceof THREE.Mesh)) return;
      const p = o.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        if (Math.abs(v.y) > pocket.edge || v.y < 0 || v.z < d.z.back - 1) continue;
        deepest = Math.min(deepest, v.y);
        highest = Math.max(highest, v.z);
      }
      o.geometry.dispose();
    });
    expect(deepest).toBeGreaterThan(pocket.back);
    expect(highest).toBeLessThan(d.z.back + pocket.height);
    lib.dispose();
  },
);

it.each(['round', 'cushion', 'tonneau', 'octagon', 'square', 'rectangle'])(
  '%s: the bezel stops before the shoulder and sits on a flat deck, with no void beneath',
  (shape) => {
    for (const type of ['smooth', 'fluted', 'rotating']) {
      const config = defaultConfig();
      config.case.shape = shape;
      config.bezel.type = type;
      config.case.construction = { ...config.case.construction!, dome: 1 };
      const d = watchDimensions(config),
        { R, c } = caseLevels(d),
        deck = caseDeckTop(d),
        layout = caseEnvelopeLayout(config, d),
        lib = new MaterialLibrary();
      const model = buildWatch(config, lib, { quality: 'fallback', layers: ['case'] });
      const ring = model.layers.case.getObjectByName(
        type === 'rotating' ? 'rotating-bezel' : 'independent-bezel',
      )!;
      model.root.updateMatrixWorld(true);
      const v = new THREE.Vector3();
      let lowest = Infinity,
        overhang = -Infinity,
        gap = 0;
      ring.traverse((o: THREE.Object3D) => {
        if (!(o instanceof THREE.Mesh) || o.name.startsWith('bezel-')) return;
        const p = o.geometry.getAttribute('position');
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
          const angle = Math.atan2(v.y, v.x);
          lowest = Math.min(lowest, v.z);
          overhang = Math.max(
            overhang,
            Math.hypot(v.x, v.y) - (R * shapeRadius(shape, angle) - c * 1.5),
          );
          gap = Math.max(gap, deck - layout.section(v.x, v.y).top);
        }
      });
      expect(lowest, type).toBeCloseTo(deck + 0.01, 3);
      expect(overhang, type).toBeLessThan(0);
      expect(gap, type).toBeLessThan(1e-6);
      model.dispose();
      lib.dispose();
    }
  },
  30_000,
);

it.each(['sharp', 'chamfer', 'rounded'] as const)(
  'the bezel’s outer edge follows the case edge treatment: %s',
  (edge) => {
    const config = defaultConfig();
    config.case.construction = { ...config.case.construction!, edge, edgeSizeMm: 0.3 };
    const lib = new MaterialLibrary(),
      model = buildWatch(config, lib, { quality: 'fallback', layers: ['case'] });
    const ring = model.layers.case.getObjectByName('independent-bezel')!;
    const points: [number, number][] = [];
    ring.traverse((o: THREE.Object3D) => {
      if (!(o instanceof THREE.Mesh)) return;
      const p = o.geometry.getAttribute('position');
      expect(Array.from(o.geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
      for (let i = 0; i < p.count; i++) points.push([Math.hypot(p.getX(i), p.getY(i)), p.getZ(i)]);
    });
    const outer = Math.max(...points.map(([r]) => r)),
      top = Math.max(...points.map(([, z]) => z));
    // Where the flat top starts: the edge width, in from the outer wall.
    const flat = Math.max(...points.filter(([, z]) => z > top - 1e-4).map(([r]) => r));
    expect(outer - flat).toBeCloseTo(edge === 'sharp' ? 0.01 : 0.3, 3);
    // Where the outer wall ends: the same height down from the top.
    const wall = Math.max(...points.filter(([r]) => r > outer - 1e-4).map(([, z]) => z));
    expect(top - wall).toBeCloseTo(edge === 'sharp' ? 0.01 : 0.3, 3);
    // A rounded edge is a quarter circle; a chamfer cuts straight across.
    const middle = points.filter(([r, z]) => r > flat + 0.05 && z > wall + 0.05);
    if (edge === 'rounded') {
      expect(middle.length).toBeGreaterThan(0);
      for (const [r, z] of middle) expect(Math.hypot(r - flat, z - wall)).toBeCloseTo(0.3, 3);
    } else expect(middle).toHaveLength(0);
    model.dispose();
    lib.dispose();
  },
);

it('spaces bezel cuts evenly along a shaped outline, at a constant depth', () => {
  const config = defaultConfig();
  config.case.shape = 'rectangle';
  config.bezel.type = 'notched';
  const d = watchDimensions(config),
    lib = new MaterialLibrary(),
    model = buildWatch(config, lib, { quality: 'fallback', layers: ['case'] });
  const inner = d.openingRadius + 0.285;
  const outline = bezelOutline(d, 'rectangle', 'rectangle', () => inner, 0.6);
  // Depth of the cut below the outer contour, along the outer wall just under its edge.
  const top = Math.max(
    ...(() => {
      const zs: number[] = [];
      model.layers.case.getObjectByName('independent-bezel')!.traverse((o: THREE.Object3D) => {
        if (o instanceof THREE.Mesh) {
          const p = o.geometry.getAttribute('position');
          for (let i = 0; i < p.count; i++) zs.push(p.getZ(i));
        }
      });
      return zs;
    })(),
  );
  const wall = top - 0.3;
  const samples: { angle: number; deficit: number }[] = [];
  model.layers.case.getObjectByName('independent-bezel')!.traverse((o: THREE.Object3D) => {
    if (!(o instanceof THREE.Mesh)) return;
    const p = o.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(p.getZ(i) - wall) > 1e-4) continue;
      const angle = Math.atan2(p.getY(i), p.getX(i));
      samples.push({ angle, deficit: outline.perimeter(angle) - Math.hypot(p.getX(i), p.getY(i)) });
    }
  });
  samples.sort((a, b) => a.angle - b.angle);
  // Notch centres: local maxima of the cut, then their position along the contour.
  const deepest = Math.max(...samples.map((s) => s.deficit));
  const centres = samples.filter((s, i) => {
    const before = samples[(i + samples.length - 1) % samples.length]!,
      after = samples[(i + 1) % samples.length]!;
    return s.deficit > deepest * 0.5 && s.deficit >= before.deficit && s.deficit > after.deficit;
  });
  expect(centres).toHaveLength(12);
  const along = (angle: number) => {
    let length = 0,
      previous = outline.perimeter(-Math.PI);
    for (let a = -Math.PI + 0.001; a <= angle; a += 0.001) {
      const radius = outline.perimeter(a);
      length += Math.hypot(radius - previous, radius * 0.001);
      previous = radius;
    }
    return length;
  };
  const positions = centres.map((c) => along(c.angle));
  const total = along(Math.PI);
  const gaps = positions.map((s, i) => (i ? s - positions[i - 1]! : s + total - positions.at(-1)!));
  expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(1.1);
  const depths = centres.map((c) => c.deficit);
  expect(Math.max(...depths) / Math.min(...depths)).toBeLessThan(1.15);
  model.dispose();
  lib.dispose();
});

it.each(['smooth', 'rotating'])(
  'reports the visible width of a %s bezel ring, as it is built',
  (type) => {
    const config = defaultConfig();
    config.bezel.type = type;
    const d = watchDimensions(config),
      lib = new MaterialLibrary(),
      model = buildWatch(config, lib, { quality: 'fallback', layers: ['case'] });
    const ring = model.layers.case.getObjectByName(
      type === 'rotating' ? 'rotating-bezel' : 'independent-bezel',
    )!;
    const radii: number[] = [];
    ring.traverse((o: THREE.Object3D) => {
      if (!(o instanceof THREE.Mesh) || o.name.startsWith('bezel-')) return;
      const p = o.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) radii.push(Math.hypot(p.getX(i), p.getY(i)));
    });
    // Set back from the shoulder, the ring is well under its nominal width.
    expect(bezelRingWidth(config, d)).toBeCloseTo(Math.max(...radii) - Math.min(...radii), 2);
    expect(bezelRingWidth(config, d)).toBeLessThan(d.bezelWidth - 0.5);
    model.dispose();
    lib.dispose();
  },
);
