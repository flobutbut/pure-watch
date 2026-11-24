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
