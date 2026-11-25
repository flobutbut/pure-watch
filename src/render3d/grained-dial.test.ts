import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { defaultConfig } from '../core/config/defaults';
import { CASE_SHAPES } from '../core/geometry/case-shape';
import { MaterialLibrary } from './materials';
import * as textures from './textures';

afterEach(() => vi.restoreAllMocks());

it('changing the case does not silently change the grain of the same round dial', () => {
  vi.spyOn(textures, 'grainTextures').mockImplementation(() => ({
    normal: new THREE.CanvasTexture(),
    roughness: new THREE.CanvasTexture(),
  }));
  vi.spyOn(textures, 'radialOcclusionTexture').mockReturnValue(new THREE.CanvasTexture());
  const config = defaultConfig();
  config.dial.finish = 'grained';
  const lib = new MaterialLibrary();
  const material = lib.dial(config);
  expect(material.normalMap).not.toBeNull();
  expect(material.roughnessMap).not.toBeNull();
  for (const shape of CASE_SHAPES) {
    config.case.shape = shape;
    expect(lib.dial(config)).toBe(material);
  }
  config.dial.finish = 'matte';
  expect(lib.dial(config).normalMap).toBeNull();
  lib.dispose();
});

it('layers fumé over grain while keeping its relief and independently adjusting its scale', () => {
  vi.spyOn(textures, 'grainTextures').mockImplementation(() => ({
    normal: new THREE.CanvasTexture(),
    roughness: new THREE.CanvasTexture(),
  }));
  vi.spyOn(textures, 'radialOcclusionTexture').mockReturnValue(new THREE.CanvasTexture());
  vi.spyOn(textures, 'radialGradientTexture').mockReturnValue(new THREE.CanvasTexture());
  const config = defaultConfig();
  config.dial.finish = 'grained';
  const lib = new MaterialLibrary();
  const before = lib.dial(config);
  config.details = {
    dial: { fume: 0.7, edgeColor: '#182735', grainSize: 0.8, grainDepth: 0.5, grainRoughness: 0.8 },
  };
  const after = lib.dial(config);
  expect(after.map).not.toBeNull();
  expect(after.normalMap).not.toBeNull();
  expect(after.roughnessMap).not.toBeNull();
  expect(after.normalScale.x).toBeCloseTo(before.normalScale.x * 0.5);
  expect(after.normalMap!.repeat.x).toBeCloseTo(before.normalMap!.repeat.x / 0.8);
  expect(after.roughness).toBe(0.8);
  config.details.rehaut = { ink: '#123456' };
  expect(lib.dial(config)).toBe(after);
  lib.dispose();
});

it('keeps natural iridescent colours when hidden fumé settings are retained', () => {
  vi.spyOn(textures, 'swirlTexture').mockReturnValue(new THREE.CanvasTexture());
  vi.spyOn(textures, 'radialOcclusionTexture').mockReturnValue(new THREE.CanvasTexture());
  const gradient = vi.spyOn(textures, 'radialGradientTexture');
  const config = defaultConfig();
  config.dial.finish = 'iridescent-pearl';
  config.details = { dial: { fume: 1, edgeColor: '#111317' } };
  const lib = new MaterialLibrary();
  expect(lib.dial(config).map).toBeNull();
  expect(gradient).not.toHaveBeenCalled();
  lib.dispose();
});
