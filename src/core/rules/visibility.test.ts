import { describe, expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { defaultConfig } from '../config/defaults';
import { setAtPath } from '../config/path';
import { evaluate, visibleRows } from './visibility';

describe('visibilité des lignes', () => {
  const catalog = parseCatalog(rawCatalog);
  it('a rotating ring exposes its scale and retains the hidden dial contour', () => {
    const config = defaultConfig();
    config.dial.shape = 'square';
    config.bezel.type = 'rotating';
    const ids = visibleRows(catalog.rows, config).map((r) => r.id);
    expect(ids).toContain('bezel-scale');
    expect(ids).not.toContain('dial-shape');
    config.bezel.type = 'smooth';
    const restored = visibleRows(catalog.rows, config).map((r) => r.id);
    expect(restored).not.toContain('bezel-scale');
    expect(restored).toContain('dial-shape');
    expect(config.dial.shape).toBe('square');
  });

  it.each(['none', 'cardinal', 'explorer', 'twelve', 'six-twelve', 'even', 'all', 'roman'])(
    'regroupe les chiffres %s et les index dans une seule ligne sans perdre les choix',
    (numerals) => {
      const config = defaultConfig();
      config.dial.indices.style = 'baguettes';
      config.dial.indices.numerals = numerals;
      const rows = visibleRows(catalog.rows, config);
      expect(rows.some((r) => r.id === 'numerals')).toBe(true);
      expect(rows.some((r) => r.id === 'numeral-font' || r.id === 'indices')).toBe(false);
      expect(config.dial.indices.style).toBe('baguettes');
      expect(
        catalog.rows.find((r) => r.id === 'indices')!.variants.some((v) => v.id === 'baguettes'),
      ).toBe(true);
    },
  );

  it('les palettes restent des préréglages du catalogue et quittent la navigation', () => {
    const config = defaultConfig();
    const has = (c: typeof config) =>
      visibleRows(catalog.rows, c).some((r) => r.id === 'dial-color');
    expect(catalog.rows.some((r) => r.id === 'dial-color')).toBe(true);
    expect(has(config)).toBe(false);
    expect(has(setAtPath(config, 'dial.finish', 'iridescent-pearl'))).toBe(false);
    expect(has(setAtPath(config, 'dial.finish', 'iridescent-oil'))).toBe(false);
    expect(has(setAtPath(config, 'dial.finish', 'sunburst'))).toBe(false);
    expect(visibleRows(catalog.rows, config).some((r) => r.id === 'seconds-color')).toBe(false);
  });

  it('la finition du boîtier disparaît pour la céramique et le carbone', () => {
    const config = defaultConfig();
    const has = (c: typeof config) =>
      visibleRows(catalog.rows, c).some((r) => r.id === 'case-finish');
    expect(has(config)).toBe(true);
    expect(has(setAtPath(config, 'case.material', 'ceramic'))).toBe(false);
    expect(has(setAtPath(config, 'case.material', 'carbon'))).toBe(false);
    expect(has(setAtPath(config, 'case.material', 'bronze'))).toBe(true);
  });

  it('combine les conditions', () => {
    const config = defaultConfig();
    expect(evaluate({ path: 'dial.finish', equals: 'matte' }, config)).toBe(true);
    expect(evaluate({ path: 'dial.finish', in: ['sunburst', 'fume'] }, config)).toBe(false);
    expect(
      evaluate(
        {
          all: [
            { path: 'case.shape', equals: 'round' },
            { path: 'crown.style', notEquals: 'onion' },
          ],
        },
        config,
      ),
    ).toBe(false);
    expect(
      evaluate(
        {
          any: [
            { path: 'x', equals: 1 },
            { path: 'case.diameterMm', equals: 40 },
          ],
        },
        config,
      ),
    ).toBe(true);
  });
});
