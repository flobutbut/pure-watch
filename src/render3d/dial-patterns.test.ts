import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { DIAL_PATTERN_FINISHES, dialPatternData, dialPatternHeight } from './dial-patterns';
import * as textures from './textures';
import { MaterialLibrary } from './materials';
import { defaultConfig } from '../core/config/defaults';
import { proportionsForDiameter } from '../core/geometry/dimensions';
import { CASE_SHAPES } from '../core/geometry/case-shape';
import rawCatalog from '../data/catalog.json';
import { parseCatalog } from '../core/catalog/load';
import { decodeConfigHash, encodeConfigHash } from '../core/config/url';
import { ambienceFor } from '../ui/ambience';
import { hasIntrinsicColor } from '../core/config/dial';

afterEach(() => vi.restoreAllMocks());

it.each(DIAL_PATTERN_FINISHES)(
  '%s: deterministic relief, unit normals and nonconstant roughness',
  (finish) => {
    const data = dialPatternData(finish, 33.6, 256);
    expect(dialPatternData(finish, 33.6, 256)).toBe(data);
    const normals = new Set<number>(),
      roughness = new Set<number>();
    for (let i = 0; i < data.normal.length; i += 16) {
      const [x, y, z] = [0, 1, 2].map((channel) => (data.normal[i + channel]! / 255) * 2 - 1);
      expect(Math.hypot(x!, y!, z!)).toBeCloseTo(1, 1);
      expect(data.normal[i + 3]).toBe(255);
      expect(data.roughness[i + 3]).toBe(255);
      normals.add(data.normal[i]!);
      roughness.add(data.roughness[i]!);
    }
    expect(normals.size).toBeGreaterThan(4);
    expect(roughness.size).toBeGreaterThan(10);
  },
);

it('creates genuinely different fields and retains physical pattern placement', () => {
  const signatures = DIAL_PATTERN_FINISHES.map((finish) =>
    Array.from({ length: 60 }, (_, i) =>
      dialPatternHeight(finish, i * 0.13 - 3.2, i * 0.27 - 6.7).toFixed(4),
    ).join(','),
  );
  expect(new Set(signatures).size).toBe(DIAL_PATTERN_FINISHES.length);
  expect(dialPatternHeight('clous-de-paris', 0.475, 0.475)).toBeGreaterThan(
    dialPatternHeight('clous-de-paris', 0, 0),
  );
  expect(dialPatternHeight('concentric', 2, 3)).toBeCloseTo(
    dialPatternHeight('concentric', 3, 2),
    10,
  );
  const map = textures.dialPatternTextures('vertical-brushed', 33.6, 128);
  expect(map.normal.colorSpace).toBe(THREE.NoColorSpace);
  expect(map.normal.minFilter).toBe(THREE.LinearMipmapLinearFilter);
  expect(map.normal.generateMipmaps).toBe(true);
  let x = 0,
    y = 0;
  const pixels = map.normal.image.data!;
  for (let i = 0; i < pixels.length; i += 4) {
    x += Math.abs(pixels[i]! - 127.5);
    y += Math.abs(pixels[i + 1]! - 127.5);
  }
  expect(x).toBeGreaterThan(y * 2);
  map.normal.dispose();
  map.roughness.dispose();
  for (const [span, size] of [
    [0, 512],
    [NaN, 512],
    [33, 0],
    [33, 2048],
  ])
    expect(() => dialPatternData('linen', span!, size!)).toThrow(RangeError);
});

it.each(DIAL_PATTERN_FINISHES)(
  '%s: colourable material on all shapes, maps shared by colours and fitted to size',
  (finish) => {
    // AO needs a canvas. Pattern pixels and physical materials are exercised directly in Node.
    const ao = new THREE.CanvasTexture();
    vi.spyOn(textures, 'radialOcclusionTexture').mockReturnValue(ao);
    vi.spyOn(textures, 'radialAnisotropyTexture').mockReturnValue(new THREE.CanvasTexture());
    const lib = new MaterialLibrary();
    const config = defaultConfig();
    config.dial.finish = finish;
    config.dial.color = '#3570A1';
    const material = lib.dial(config);
    expect(material.color.getHexString()).toBe('3570a1');
    expect(material.normalMap).toBeTruthy();
    expect(material.roughnessMap).toBeTruthy();
    if (finish === 'leather') {
      expect(material.metalness).toBe(0);
      expect(material.clearcoat).toBe(0);
    }
    if (finish === 'circular-brushed') {
      expect(material.anisotropy).toBeGreaterThan(0);
      expect(material.anisotropyMap).toBeTruthy();
    }
    config.dial.color = '#D8B681';
    const warm = lib.dial(config);
    expect(warm).not.toBe(material);
    expect(warm.normalMap).toBe(material.normalMap);
    expect(warm.roughnessMap).toBe(material.roughnessMap);
    expect(warm.color.getHexString()).toBe('d8b681');
    for (const shape of CASE_SHAPES) {
      config.case.shape = config.dial.shape = shape;
      Object.assign(config.case, proportionsForDiameter(22));
      const small = lib.dial(config);
      Object.assign(config.case, proportionsForDiameter(48));
      const large = lib.dial(config);
      expect(large.normalMap).not.toBe(small.normalMap);
      expect((large.normalMap as THREE.DataTexture).image.width).toBe(512);
    }
    lib.dispose();
  },
);

it.each(DIAL_PATTERN_FINISHES)(
  '%s: catalog, old wire identifiers, custom colour and ambience remain consistent',
  (finish) => {
    const catalog = parseCatalog(rawCatalog);
    expect(
      catalog.rows.find((r) => r.id === 'dial-finish')!.variants.some((v) => v.value === finish),
    ).toBe(true);
    const config = defaultConfig();
    config.dial.finish = finish;
    config.dial.color = '#213FAC';
    expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
    expect(hasIntrinsicColor(finish)).toBe(false);
    for (const color of ['#213FAC', '#EDE4D1']) {
      const ambience = ambienceFor({ finish, color });
      expect(ambience.key).toBe(`${finish}:${color}`);
      expect(ambience.layers).not.toContain('undefined');
      expect(ambience.drift).toBe(false);
    }
    const old = `#v1.${btoa(JSON.stringify({ w: 9, x: '#123ABC' })).replace(/=+$/, '')}`;
    expect(decodeConfigHash(old, catalog).config.dial.finish).toBe('fume');
  },
);
