import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { WatchConfig } from '../../core/config/types';
import { defaultConfig } from '../../core/config/defaults';
import type { MaterialSettings } from '../../core/config/material';
import { watchDimensions } from '../../core/geometry/dimensions';
import { MaterialLibrary } from '../materials';
import * as textures from '../textures';
import { buildDial } from './dial';

const markups: Promise<string>[] = [];
vi.spyOn(textures, 'svgTexture').mockImplementation((markup) => {
  markups.push(Promise.resolve(markup));
  return {
    texture: new THREE.CanvasTexture(undefined as unknown as HTMLCanvasElement),
    ready: Promise.resolve(),
  };
});

/** Chiffres des heures dans une impression (le texte de marque n'est pas centré ainsi). */
const numeralCount = (svg: string) => svg.split('dominant-baseline="central"').length - 1;

async function dial(
  numerals?: MaterialSettings,
  ring = false,
  customize?: (config: WatchConfig) => void,
) {
  markups.length = 0;
  const config = defaultConfig();
  config.dial.indices.numerals = 'all';
  config.details = {
    ...(numerals ? { numerals } : {}),
    ...(ring ? { ring: { shape: 'ring' as const } } : {}),
  };
  customize?.(config);
  const lib = new MaterialLibrary();
  vi.spyOn(lib, 'dial').mockReturnValue(lib.polishedSteel());
  const parts = buildDial(config, watchDimensions(config), lib);
  const layers: THREE.Mesh[] = [];
  parts.print.traverse((child) => {
    if (child instanceof THREE.Mesh && child.name === 'numerals') layers.push(child);
  });
  const svgs = await Promise.all(markups);
  return {
    layers,
    materials: layers.map((mesh) => mesh.material as THREE.MeshPhysicalMaterial),
    // Impressions du cadran (le calque des chiffres, lui, est tout blanc).
    printed: svgs
      .filter((svg) => svg.includes('stroke-linecap') && !svg.includes('stroke="#ffffff"'))
      .map(numeralCount),
    glyphs: svgs.filter((svg) => svg.includes('stroke="#ffffff"')).map(numeralCount),
  };
}

describe('matière des chiffres', () => {
  it('garde l’encre mate dans l’impression, sans calque à part', async () => {
    const { layers, printed } = await dial();
    expect(layers).toHaveLength(0);
    expect(printed[0]).toBe(12);
  });

  it('sort les chiffres en métal de l’impression et les pose en métal poli ou brossé', async () => {
    const polished = await dial({ kind: 'metal', metal: 'gold' });
    expect(polished.layers).toHaveLength(1);
    expect(polished.printed.length).toBeGreaterThan(0);
    expect(polished.printed.every((count) => count === 0)).toBe(true);
    expect(polished.glyphs[0]).toBe(12);
    expect(polished.materials[0]!.metalness).toBe(1);
    expect(polished.materials[0]!.bumpMap).toBeTruthy();
    const brushed = await dial({ kind: 'metal', effect: 'brushed' });
    expect(brushed.materials[0]!.anisotropy).toBeGreaterThan(0);
    expect(brushed.materials[0]!.roughnessMap).toBeTruthy();
    expect(brushed.materials[0]!.bumpMap).toBeNull();
  });

  it('vernit l’encre en relief et fait briller la matière luminescente', async () => {
    const varnished = await dial({ kind: 'ink', effect: 'varnished' });
    expect(varnished.materials[0]!.clearcoat).toBe(1);
    expect(varnished.materials[0]!.bumpMap).toBeTruthy();
    const lume = await dial({ kind: 'lume', lume: 'bgw9' });
    expect(lume.materials[0]!.name).toBe('printed-lume');
    expect(lume.materials[0]!.emissive.getHexString()).not.toBe('000000');
  });

  it('pose aussi les chiffres sur l’anneau, à sa hauteur', async () => {
    const { layers } = await dial({ kind: 'metal' }, true);
    expect(layers).toHaveLength(2);
    expect(layers[1]!.position.z).toBeGreaterThan(layers[0]!.position.z);
    expect(
      layers.every((mesh) => (mesh.material as THREE.Material & { alphaMap: unknown }).alphaMap),
    ).toBe(true);
  });
});

it('un chiffre personnalisé en métal reste sur son calque, même sans chiffres dans la disposition', async () => {
  const { layers, printed, glyphs } = await dial({ kind: 'metal' }, false, (config) => {
    config.dial.indices.numerals = 'none';
    config.details!.hourMarkers = { '7': 'numeral' };
  });
  expect(layers).toHaveLength(1);
  expect(printed.every((count) => count === 0)).toBe(true);
  expect(glyphs[0]).toBe(1);
});
