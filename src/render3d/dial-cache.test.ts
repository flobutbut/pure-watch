import { expect, it } from 'vitest';
import rawCatalog from '../data/catalog.json';
import { parseCatalog } from '../core/catalog/load';
import { defaultConfig } from '../core/config/defaults';
import { PartRenderer3D } from './part-renderer';
import type { PartRequest } from '../render/types';

it('refreshes dependent previews for the aperture, without invalidating hands for dial colour', () => {
  const catalog = parseCatalog(rawCatalog);
  const renderer = new PartRenderer3D(catalog);
  const round = defaultConfig();
  const square = structuredClone(round);
  square.dial.shape = 'square';
  const recoloured = structuredClone(round);
  recoloured.dial.color = '#fedcba';
  for (const rowId of ['case-shape', 'crystal', 'hands', 'seconds', 'dial-finish']) {
    const row = catalog.rows.find((r) => r.id === rowId)!;
    const request: PartRequest = {
      rowId,
      variantId: row.variants[0]!.id,
      context: row.previewContext,
      config: round,
      sizePx: 160,
      pixelRatio: 1,
    };
    const initial = renderer.cacheKey(request);
    expect(renderer.cacheKey({ ...request, config: square })).not.toBe(initial);
    if (rowId === 'hands' || rowId === 'seconds')
      expect(renderer.cacheKey({ ...request, config: recoloured })).toBe(initial);
  }
  renderer.dispose();
});

it('refreshes bezel-dependent previews without invalidating hands or isolated dials', () => {
  const catalog = parseCatalog(rawCatalog);
  const renderer = new PartRenderer3D(catalog);
  const config = defaultConfig();
  const changed = structuredClone(config);
  changed.bezel.type = 'fluted';
  for (const rowId of ['case-shape', 'crystal', 'hands', 'dial-finish']) {
    const row = catalog.rows.find((r) => r.id === rowId)!;
    const request: PartRequest = {
      rowId,
      variantId: row.variants[0]!.id,
      context: row.previewContext,
      config,
      sizePx: 160,
      pixelRatio: 1,
    };
    const same = renderer.cacheKey(request) === renderer.cacheKey({ ...request, config: changed });
    expect(same).toBe(rowId === 'hands' || rowId === 'dial-finish');
  }
  renderer.dispose();
});

it('updates the dial and hands for rehaut width, but only rehaut previews for its colour or scale', () => {
  const catalog = parseCatalog(rawCatalog);
  const renderer = new PartRenderer3D(catalog);
  const config = defaultConfig();
  const wide = structuredClone(config);
  wide.rehaut.profile = 'sloped';
  const coloured = structuredClone(config);
  coloured.rehaut.finish = 'custom';
  coloured.rehaut.color = '#123ABC';
  const graduated = structuredClone(config);
  graduated.rehaut.scale = 'five-minute';
  for (const rowId of [
    'case-shape',
    'crystal',
    'hands',
    'seconds',
    'dial-finish',
    'chapter-ring',
    'indices',
  ]) {
    const row = catalog.rows.find((r) => r.id === rowId)!;
    const request: PartRequest = {
      rowId,
      variantId: row.variants[0]!.id,
      context: row.previewContext,
      config,
      sizePx: 160,
      pixelRatio: 1,
    };
    const initial = renderer.cacheKey(request);
    expect(renderer.cacheKey({ ...request, config: wide })).not.toBe(initial);
    const showsRehaut = ['case-shape', 'crystal'].includes(rowId);
    expect(renderer.cacheKey({ ...request, config: coloured }) !== initial).toBe(showsRehaut);
    expect(renderer.cacheKey({ ...request, config: graduated }) !== initial).toBe(showsRehaut);
  }
  renderer.dispose();
});
