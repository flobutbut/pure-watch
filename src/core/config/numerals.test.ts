import { describe, expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { applyVariant, variantIndexFromConfig } from '../nav/selection';
import { visibleRows } from '../rules/visibility';
import { colorChoice, withColorChoice } from './colors';
import { defaultConfig } from './defaults';
import { decodeConfigHash, encodeConfigHash } from './url';

const catalog = parseCatalog(rawCatalog);
const hash = (payload: object) => '#v1.' + btoa(JSON.stringify(payload)).replace(/=+$/, '');

describe('écriture et disposition indépendantes', () => {
  it.each(['none', 'twelve', 'six-twelve', 'cardinal', 'explorer', 'all'] as const)(
    '%s conserve l’écriture dans le lien et la disponibilité des index',
    (layout) => {
      const config = defaultConfig();
      config.dial.indices.numerals = layout;
      config.dial.indices.numeralSystem = 'roman';
      expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
      expect(visibleRows(catalog.rows, config).some((r) => r.id === 'indices')).toBe(
        layout !== 'all',
      );
    },
  );

  it('conserve la date, la disposition, les réglages et la typographie quand l’écriture change', () => {
    const config = defaultConfig();
    Object.assign(config.dial.indices, {
      numerals: 'cardinal',
      numeralFont: 'art-deco',
      numeralSize: 1.35,
      numeralRadius: 0.85,
      numeralColor: '#CC8844',
    });
    config.complications = [{ type: 'date', position: '3h' }];
    const next = withColorChoice(config, 'numerals', {
      ...colorChoice(config, 'numerals'),
      numeralSystem: 'roman',
    });
    expect(next.dial.indices).toEqual({ ...config.dial.indices, numeralSystem: 'roman' });
    expect(next.complications).toBe(config.complications);
    const row = catalog.rows.find((r) => r.id === 'numerals')!;
    const twelve = applyVariant(
      next,
      row,
      row.variants.findIndex((v) => v.id === 'twelve'),
    );
    expect(twelve.dial.indices.numeralSystem).toBe('roman');
    const back = withColorChoice(twelve, 'numerals', {
      ...colorChoice(twelve, 'numerals'),
      numeralSystem: 'arabic',
    });
    expect(back.dial.indices.numerals).toBe('twelve');
    expect(back.dial.indices.numeralSystem).toBe('arabic');
  });

  it('convertit D=7 en tous les chiffres romains sans changer les valeurs par défaut v1', () => {
    const { config, notice } = decodeConfigHash(
      hash({ D: 7, E: 4, aj: 1.3, ak: 0.9, A: 9 }),
      catalog,
    );
    expect(notice).toBe('');
    expect(config.dial.indices).toMatchObject({
      numerals: 'all',
      numeralSystem: 'roman',
      numeralFont: 'serif',
      numeralSize: 1.3,
      numeralRadius: 0.9,
    });
    const row = catalog.rows.find((r) => r.id === 'numerals')!;
    expect(row.variants[variantIndexFromConfig(row, config)]!.id).toBe('all');
    expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
    expect(encodeConfigHash(defaultConfig())).toBe('#2');
    expect(decodeConfigHash(hash({ D: 4 }), catalog).config.dial.indices).toMatchObject({
      numerals: 'twelve',
      numeralSystem: 'arabic',
    });
  });
});
