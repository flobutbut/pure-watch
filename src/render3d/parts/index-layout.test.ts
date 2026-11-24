import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../core/config/defaults';
import type { WatchConfig } from '../../core/config/types';
import { watchDimensions } from '../../core/geometry/dimensions';
import type { MaterialLibrary } from '../materials';
import { buildIndices } from './dial';

// Only the geometry matters here: a plain material avoids the texture work of the library.
const lib = { polishedSteel: () => new THREE.MeshStandardMaterial() } as unknown as MaterialLibrary;

/** Closest index point, radial reach along the cardinal axes, and the 3 h index length. */
function indexExtent(config: WatchConfig) {
  const group = buildIndices(config, watchDimensions(config), lib);
  let inner = Infinity;
  let outer = 0;
  let threeMin = Infinity;
  let threeMax = -Infinity;
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.updateWorldMatrix(true, false);
    const p = o.geometry.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      const r = Math.hypot(v.x, v.y);
      inner = Math.min(inner, r);
      // Radial reach of the cardinal indices (the twin 12 o'clock bars sit side by side).
      outer = Math.max(outer, Math.abs(v.x), Math.abs(v.y));
      if (Math.abs(v.y) < 0.5 && v.x > 0) {
        threeMin = Math.min(threeMin, v.x);
        threeMax = Math.max(threeMax, v.x);
      }
    }
  });
  return { inner, outer, length: threeMax - threeMin };
}

describe('taille et position des index', () => {
  it('rapproche les index du centre et les agrandit', () => {
    const reference = indexExtent(defaultConfig());
    const config = defaultConfig();
    config.dial.indices.indexRadius = 0.7;
    expect(indexExtent(config).outer).toBeLessThan(reference.outer * 0.8);
    config.dial.indices.indexRadius = 1;
    config.dial.indices.indexSize = 1.4;
    expect(indexExtent(config).length / reference.length).toBeGreaterThan(1.35);
  });

  it('arrête un grand index poussé au bord avant la minuterie', () => {
    const config = defaultConfig();
    config.dial.indices.indexSize = 1.6;
    config.dial.indices.indexRadius = 1.1;
    const R = watchDimensions(config).dialSafeRadius;
    expect(indexExtent(config).outer).toBeLessThanOrEqual(R * 0.9 + 1e-3);
  });
});
