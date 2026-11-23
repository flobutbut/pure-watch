import { describe, expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { defaultConfig } from '../config/defaults';
import { setAtPath } from '../config/path';
import { evaluate, visibleRows } from './visibility';

describe('visibilité des lignes', () => {
  const catalog = parseCatalog(rawCatalog);

  it('la typographie des chiffres n’apparaît que s’il y a des chiffres', () => {
    const config = defaultConfig();
    expect(visibleRows(catalog.rows, config).some((r) => r.id === 'numeral-font')).toBe(false);
    const withNumerals = setAtPath(config, 'dial.indices.numerals', 'cardinal');
    expect(visibleRows(catalog.rows, withNumerals).some((r) => r.id === 'numeral-font')).toBe(true);
  });

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
