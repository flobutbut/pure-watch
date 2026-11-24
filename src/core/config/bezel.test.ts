import { expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { visibleRows } from '../rules/visibility';
import { applyVariant, variantIndexFromConfig } from '../nav/selection';
import { bezelScale } from './bezel';
import { defaultConfig } from './defaults';
import { decodeConfigHash, encodeConfigHash } from './url';

it('shares a fixed scale and colour, preserves the hidden dial and restores the rotating scale', () => {
  const catalog = parseCatalog(rawCatalog);
  let config = defaultConfig();
  config.dial.shape = 'square';
  config.bezel.type = 'fixed-scale';
  config.bezel.angleDeg = 42;
  config.bezel.color = '#3A6382';
  const ids = visibleRows(catalog.rows, config).map((r) => r.id);
  expect(ids).toContain('fixed-bezel-scale');
  expect(ids).not.toContain('bezel-scale');
  expect(ids).not.toContain('dial-shape');
  const row = catalog.rows.find((r) => r.id === 'fixed-bezel-scale')!;
  expect(row.variants[variantIndexFromConfig(row, config)]!.value).toBe(bezelScale(config));
  for (let i = 0; i < row.variants.length; i++) {
    config = applyVariant(config, row, i);
    expect(bezelScale(config)).toBe(row.variants[i]!.value);
    expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
  }
  config.bezel.scale = 'tachymeter';
  config.bezel.type = 'rotating';
  expect(bezelScale(config)).toBe('dive-60');
  expect(visibleRows(catalog.rows, config).map((r) => r.id)).toContain('bezel-scale');
  config.bezel.type = 'smooth';
  expect(visibleRows(catalog.rows, config).map((r) => r.id)).toContain('dial-shape');
  expect(config.dial.shape).toBe('square');
  expect(config.bezel.color).toBe('#3A6382');
});
