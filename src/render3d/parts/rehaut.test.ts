import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { defaultConfig } from '../../core/config/defaults';
import {
  DEFAULT_REHAUT,
  REHAUT_PROFILES,
  canConfigureRehaut,
  effectiveRehautProfile,
  effectiveRehautScale,
} from '../../core/config/rehaut';
import { CASE_SHAPES } from '../../core/geometry/case-shape';
import { DIAL_SHAPES, dialContourFactor } from '../../core/geometry/dial-shape';
import { proportionsForDiameter, watchDimensions } from '../../core/geometry/dimensions';
import { MaterialLibrary } from '../materials';
import { buildWatch } from '../watch';
import { rehautProfile } from './rehaut';
import { caseLevels } from './levels';
import * as textures from '../textures';

it.each(CASE_SHAPES)(
  '%s: all rehaut profiles join the opening and keep the hands inside the dial',
  (shape) => {
    const lib = new MaterialLibrary();
    for (const dial of DIAL_SHAPES)
      for (const profile of REHAUT_PROFILES) {
        const config = defaultConfig();
        config.case.shape = shape;
        config.dial.shape = dial;
        config.rehaut.profile = profile;
        Object.assign(config.case, proportionsForDiameter(profile === 'concave' ? 22 : 48));
        const d = watchDimensions(config);
        const model = buildWatch(config, lib, {
          quality: 'fallback',
          layers: ['case', 'rehaut', 'hands', 'seconds'],
        });
        model.root.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          expect(Array.from(o.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(
            true,
          );
          expect(Array.from(o.geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(
            true,
          );
        });
        const ring = model.layers.rehaut.children[0] as THREE.Mesh;
        const p = ring.geometry.getAttribute('position');
        const { rehautTop } = caseLevels(d);
        for (let i = 0; i < p.count; i += 5) {
          const a = Math.atan2(p.getY(i), p.getX(i));
          const normalized = Math.hypot(p.getX(i), p.getY(i)) / dialContourFactor(d, a);
          expect(normalized).toBeGreaterThanOrEqual(d.dialRadius - 0.0001);
          expect(normalized).toBeLessThanOrEqual(d.openingRadius + 0.0001);
          expect(p.getZ(i)).toBeLessThanOrEqual(rehautTop + 0.0001);
        }
        expect(d.hands.second).toBeLessThan(d.dialSafeRadius);
        if (canConfigureRehaut(config) && profile !== 'classic') {
          expect(rehautProfile(config, d)[0]).toEqual([d.openingRadius, rehautTop]);
          expect(rehautProfile(config, d).at(-1)![0]).toBe(d.dialRadius);
          expect(d.openingRadius - d.dialRadius).toBeGreaterThanOrEqual(0.99);
        }
        model.dispose();
      }
    lib.dispose();
  },
  20_000,
);

describe('rehaut compatibility and resources', () => {
  it('retains historic dimensions and ignores unavailable scales without losing saved choices', () => {
    const config = defaultConfig();
    const old = watchDimensions(config);
    expect(config.rehaut).toEqual(DEFAULT_REHAUT);
    expect(old.dialRadius).toBeCloseTo(16.8);
    config.rehaut.scale = 'tachymeter';
    expect(effectiveRehautScale(config)).toBe('none');
    config.rehaut.profile = 'sloped';
    expect(effectiveRehautScale(config)).toBe('tachymeter');
    const fitted = watchDimensions(config);
    expect(fitted.dialRadius).toBeLessThan(old.dialRadius);
    expect(fitted.hands.second).toBeLessThan(old.hands.second);
    expect(fitted.z).toEqual(old.z);
    config.case.shape = 'rectangle';
    expect(effectiveRehautProfile(config)).toBe('classic');
    expect(effectiveRehautScale(config)).toBe('none');
    config.dial.shape = 'rectangle';
    expect(effectiveRehautProfile(config)).toBe('sloped');
    expect(effectiveRehautScale(config)).toBe('tachymeter');
  });
  it('waits for graduations and disposes their resources independently of shared materials', async () => {
    const texture = new THREE.Texture();
    let complete!: () => void;
    const ready = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const mock = vi
      .spyOn(textures, 'svgTexture')
      .mockReturnValue({ texture: texture as THREE.CanvasTexture, ready });
    const disposed = vi.spyOn(texture, 'dispose');
    const config = defaultConfig();
    config.rehaut.profile = 'sloped';
    config.rehaut.scale = 'five-minute';
    const lib = new MaterialLibrary();
    const model = buildWatch(config, lib, { quality: 'fallback', layers: ['rehaut'] });
    const decal = model.root.getObjectByName('rehaut-graduations') as THREE.Mesh;
    const material = decal.material as THREE.Material;
    const disposedMaterial = vi.spyOn(material, 'dispose');
    const shared = vi.spyOn(lib.rehaut(config), 'dispose');
    let loaded = false;
    void model.ready.then(() => {
      loaded = true;
    });
    await Promise.resolve();
    expect(loaded).toBe(false);
    complete();
    await model.ready;
    expect(loaded).toBe(true);
    expect((material as THREE.MeshStandardMaterial).alphaTest).toBeGreaterThan(0);
    model.dispose();
    expect(disposed).toHaveBeenCalledOnce();
    expect(disposedMaterial).toHaveBeenCalledOnce();
    expect(shared).not.toHaveBeenCalled();
    lib.dispose();
    mock.mockRestore();
  });
});
