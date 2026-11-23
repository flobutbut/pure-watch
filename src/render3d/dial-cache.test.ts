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
