import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { INDEX_RADIUS_RANGE } from '../../core/config/colors';
import { defaultConfig } from '../../core/config/defaults';
import type { WatchConfig } from '../../core/config/types';
import { watchDimensions } from '../../core/geometry/dimensions';
import { DIAL_SHAPES, dialRadiusAt } from '../../core/geometry/dial-shape';
import type { MaterialLibrary } from '../materials';
import { INDEX_REACH, buildIndices } from './dial';

// Only the geometry matters here: a plain material avoids the texture work of the library.
const lib = { polishedSteel: () => new THREE.MeshStandardMaterial() } as unknown as MaterialLibrary;

/** Closest index point, radial reach along the cardinal axes, and the 3 h index length and width. */
function indexExtent(config: WatchConfig) {
  const group = buildIndices(config, watchDimensions(config), lib);
  let inner = Infinity;
  let outer = 0;
  let threeMin = Infinity;
  let threeMax = -Infinity;
  let threeSide = 0;
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.updateWorldMatrix(true, false);
    const p = o.geometry.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      const r = Math.hypot(v.x, v.y);
      inner = Math.min(inner, r);
      // Radial reach of the cardinal indices.
      outer = Math.max(outer, Math.abs(v.x), Math.abs(v.y));
      // A narrow sector around 3 h: wide enough for a widened index, clear of 2 h and 4 h.
      if (v.x > 0 && Math.abs(v.y) < v.x * 0.25) {
        threeMin = Math.min(threeMin, v.x);
        threeMax = Math.max(threeMax, v.x);
        threeSide = Math.max(threeSide, Math.abs(v.y));
      }
    }
  });
  return { inner, outer, length: threeMax - threeMin, width: threeSide * 2 };
}

describe('taille et position des index', () => {
  it.each(['dive', 'mixed-batons'])(
    '%s combine les formes et libère les heures occupées',
    (style) => {
      const config = defaultConfig();
      config.dial.indices.style = style;
      const spans = () => {
        const group = buildIndices(config, watchDimensions(config), lib);
        const buckets = Array.from({ length: 12 }, () => [] as number[]);
        group.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          const p = o.geometry.getAttribute('position');
          for (let i = 0; i < p.count; i++) {
            const x = p.getX(i),
              y = p.getY(i);
            const hour = ((Math.round((Math.atan2(x, y) * 6) / Math.PI) % 12) + 12) % 12;
            buckets[hour]!.push(Math.hypot(x, y));
          }
          o.geometry.dispose();
        });
        return buckets.map((points) =>
          points.length ? Math.max(...points) - Math.min(...points) : 0,
        );
      };
      const complete = spans();
      expect(complete.every((extent) => extent > 0)).toBe(true);
      expect(complete[3]).toBeGreaterThan(complete[2]! * 1.4);
      config.dial.indices.numerals = 'twelve';
      config.complications = [
        { type: 'date', position: '3h' },
        { type: 'small-seconds', position: '6h' },
      ];
      const occupied = spans();
      expect([occupied[0], occupied[3], occupied[6]]).toEqual([0, 0, 0]);
      expect(occupied[9]).toBeGreaterThan(0);
      config.dial.indices.indexLength = 1.6;
      config.dial.indices.indexWidth = 1.8;
      config.dial.indices.indexRadius = 1.1;
      expect(indexExtent(config).outer).toBeLessThanOrEqual(
        watchDimensions(config).dialSafeRadius * INDEX_REACH + 1e-3,
      );
    },
  );
  it('rapproche les index du centre et les agrandit', () => {
    const reference = indexExtent(defaultConfig());
    const config = defaultConfig();
    config.dial.indices.indexRadius = 0.7;
    expect(indexExtent(config).outer).toBeLessThan(reference.outer * 0.8);
    config.dial.indices.indexRadius = 1;
    config.dial.indices.indexLength = 1.4;
    const longer = indexExtent(config);
    expect(longer.length / reference.length).toBeGreaterThan(1.35);
    expect(longer.width / reference.width).toBeCloseTo(1, 2);
  });

  it('règle la largeur sans toucher à la longueur', () => {
    const reference = indexExtent(defaultConfig());
    const config = defaultConfig();
    config.dial.indices.indexWidth = 1.6;
    const wider = indexExtent(config);
    expect(wider.width / reference.width).toBeCloseTo(1.6, 1);
    expect(wider.length / reference.length).toBeCloseTo(1, 2);
    expect(wider.outer).toBeCloseTo(reference.outer, 2);
  });

  it("laisse un grand index recouvrir la minuterie et l'arrête juste avant le réhaut", () => {
    const config = defaultConfig();
    config.dial.chapterRing = 'railroad';
    config.dial.indices.indexLength = 1.6;
    config.dial.indices.indexRadius = 1.1;
    const R = watchDimensions(config).dialSafeRadius;
    const { outer } = indexExtent(config);
    // La minuterie chemin de fer va de 0,93 R à 0,985 R : l'index la recouvre entièrement.
    expect(outer).toBeGreaterThan(R * 0.99);
    expect(outer).toBeLessThanOrEqual(R * INDEX_REACH + 1e-3);
  });

  it.each(['baton', 'dots', 'dauphine', 'triangles'])(
    '%s de taille standard au bout du curseur touche la limite, au-delà de la minuterie',
    (style) => {
      const config = defaultConfig();
      config.dial.indices.style = style;
      config.dial.indices.indexRadius = INDEX_RADIUS_RANGE.max;
      const R = watchDimensions(config).dialSafeRadius;
      expect(indexExtent(config).outer).toBeCloseTo(R * INDEX_REACH, 2);
      config.dial.indices.indexRadius = 1;
      expect(indexExtent(config).outer).toBeLessThan(R * 0.93);
    },
  );
});

it('rend seulement les index demandés, y compris dans un cadran entièrement chiffré', () => {
  const config = defaultConfig();
  config.dial.indices.numerals = 'all';
  config.details = { hourMarkers: { '1': 'index', '2': 'none', '6': 'index' } };
  config.complications = [{ type: 'small-seconds', position: '6h' }];
  const group = buildIndices(config, watchDimensions(config), lib);
  const hours = new Set<number>();
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const p = o.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++)
      hours.add((Math.round((Math.atan2(p.getX(i), p.getY(i)) * 6) / Math.PI) + 12) % 12);
    o.geometry.dispose();
  });
  expect([...hours]).toEqual([1]);
});

it('rend douze index simples par défaut et double uniquement les heures sélectionnées', () => {
  const config = defaultConfig();
  const counts = () => {
    const counts = Array<number>(12).fill(0);
    const group = buildIndices(config, watchDimensions(config), lib);
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const positions = object.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const angle = Math.atan2(positions.getX(i), positions.getY(i));
        const hour = (Math.round((angle * 6) / Math.PI) + 12) % 12;
        counts[hour]!++;
      }
      object.geometry.dispose();
    });
    return counts;
  };
  const ordinary = counts();
  expect(ordinary[0]).toBeGreaterThan(0);
  expect(ordinary).toEqual(Array(12).fill(ordinary[0]));
  config.details = { doubleIndices: { '5': true, '12': true } };
  expect(counts()).toEqual(ordinary.map((count, h) => (h === 0 || h === 5 ? 2 * count : count)));
  config.dial.indices.numerals = 'empty';
  expect(counts()).toEqual(Array(12).fill(0));
  config.details.hourMarkers = { '5': 'index', '12': 'numeral' };
  expect(counts()).toEqual(ordinary.map((count, h) => (h === 5 ? 2 * count : 0)));
});

it.each(DIAL_SHAPES)(
  'garde les index doubles sur le cadran %s aux dimensions maximales',
  (shape) => {
    const config = defaultConfig();
    config.dial.shape = shape;
    Object.assign(config.dial.indices, {
      style: 'triangles',
      indexLength: 1.6,
      indexWidth: 1.8,
      indexRadius: INDEX_RADIUS_RANGE.max,
    });
    config.details = { doubleIndices: { '2': true, '5': true, '12': true } };
    const d = watchDimensions(config);
    const group = buildIndices(config, d, lib);
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const positions = object.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const angle = Math.atan2(y, x);
        const hour = (Math.round((Math.atan2(x, y) * 6) / Math.PI) + 12) % 12;
        if (![0, 2, 5].includes(hour)) continue;
        expect(Math.hypot(x, y)).toBeLessThan(dialRadiusAt(d, angle));
      }
      object.geometry.dispose();
    });
  },
);
