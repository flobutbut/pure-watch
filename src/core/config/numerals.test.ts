import { describe, expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { applyVariant, variantIndexFromConfig } from '../nav/selection';
import { visibleRows } from '../rules/visibility';
import { colorChoice, withColorChoice } from './colors';
import { defaultConfig } from './defaults';
import { decodeConfigHash, encodeConfigHash } from './url';

import { hourMarkerAt, indexHours, isDoubleIndex, numeralHours } from './numerals';
import { detailsSchema } from './details';

const catalog = parseCatalog(rawCatalog);
const hash = (payload: object) => '#v1.' + btoa(JSON.stringify(payload)).replace(/=+$/, '');

describe('écriture et disposition indépendantes', () => {
  it.each(['none', 'twelve', 'six-twelve', 'cardinal', 'explorer', 'even', 'all'] as const)(
    '%s conserve l’écriture dans le lien et la disponibilité des index',
    (layout) => {
      const config = defaultConfig();
      config.dial.indices.numerals = layout;
      config.dial.indices.numeralSystem = 'roman';
      expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
      expect(visibleRows(catalog.rows, config).some((r) => r.id === 'indices')).toBe(false);
      expect(visibleRows(catalog.rows, config).some((r) => r.id === 'numerals')).toBe(true);
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

it('les exceptions choisissent chiffre, index ou rien et se retrouvent dans les liens', () => {
  const config = defaultConfig();
  config.dial.indices.numerals = 'even';
  config.details = {
    hourMarkers: { '12': 'none', '1': 'numeral', '2': 'index' },
    indices: { '2': { style: 'dots' } },
  };
  expect(numeralHours('even', config.details.hourMarkers)).toEqual([1, 4, 6, 8, 10]);
  expect([0, 1, 2, 3].map((h) => hourMarkerAt(config, h))).toEqual([
    'none',
    'numeral',
    'index',
    'index',
  ]);
  expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
  const row = catalog.rows.find((r) => r.id === 'numerals')!;
  const preset = applyVariant(
    config,
    row,
    row.variants.findIndex((v) => v.id === 'cardinal'),
  );
  expect(preset.details?.hourMarkers).toBeUndefined();
  expect(preset.details?.indices).toEqual(config.details.indices);
  expect(preset.dial.indices.numeralFont).toBe(config.dial.indices.numeralFont);
});

it('refuse les heures et types de repères invalides dans les liens', () => {
  for (const hourMarkers of [{ '0': 'index' }, { '13': 'numeral' }, { '1': 'baton' }])
    expect(detailsSchema.safeParse({ hourMarkers }).success).toBe(false);
  for (const doubleIndices of [{ '0': true }, { '13': true }, { '1': false }])
    expect(detailsSchema.safeParse({ doubleIndices }).success).toBe(false);
});

it('choisit une disposition vide et mémorise les index doubles indépendamment de la disposition', () => {
  const config = defaultConfig();
  expect(isDoubleIndex(config, 0)).toBe(false);
  config.details = { doubleIndices: { '5': true, '12': true } };
  const row = catalog.rows.find((r) => r.id === 'numerals')!;
  const empty = applyVariant(
    config,
    row,
    row.variants.findIndex((v) => v.id === 'empty'),
  );
  expect(indexHours(empty)).toEqual([]);
  expect(numeralHours(empty.dial.indices.numerals)).toEqual([]);
  expect(empty.details?.doubleIndices).toEqual(config.details.doubleIndices);
  expect(decodeConfigHash(encodeConfigHash(empty), catalog)).toEqual({ config: empty, notice: '' });
  expect(decodeConfigHash(hash({ D: 9 }), catalog).config.dial.indices.numerals).toBe('empty');
  empty.details = { ...empty.details, hourMarkers: { '5': 'index', '12': 'numeral' } };
  expect(indexHours(empty)).toEqual([5]);
  expect(numeralHours('empty', empty.details.hourMarkers)).toEqual([0]);
  expect(isDoubleIndex(empty, 5)).toBe(true);
});

it('enregistre tout le panneau sans changer les autres pièces et rétablit exactement l’état initial', () => {
  const config = defaultConfig();
  const initial = colorChoice(config, 'markers');
  expect(encodeConfigHash(withColorChoice(config, 'markers', initial))).toBe('#2');
  const modified = withColorChoice(config, 'markers', {
    ...initial,
    markers: { ...config.dial.indices, numerals: 'even', style: 'dots', numeralFont: 'art-deco' },
    details: { hourMarkers: { '3': 'numeral' } },
  });
  expect(modified.hands).toBe(config.hands);
  expect(modified.dial.indices).toMatchObject({
    numerals: 'even',
    style: 'dots',
    numeralFont: 'art-deco',
  });
  expect(withColorChoice(config, 'markers', initial)).toEqual(config);
});
