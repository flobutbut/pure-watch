import { describe, expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { applyVariant } from '../nav/selection';
import { defaultConfig } from './defaults';
import { blackTonneauPilot, cushionPilot } from './pilot';
import { configUrl, decodeConfigHash, encodeConfigHash, readConfigUrl } from './url';

const catalog = parseCatalog(rawCatalog);
const hash = (payload: unknown) =>
  `#v1.${btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`;

describe('versioned watch links', () => {
  it('keeps historic bezel tokens and appends the two new profiles', () => {
    for (const [type, token] of Object.entries({
      smooth: 1,
      coin: 4,
      fluted: 5,
      notched: 6,
      rotating: 7,
      rounded: 8,
      stepped: 9,
    })) {
      expect(decodeConfigHash(hash({ n: token }), catalog).config.bezel.type).toBe(type);
    }
  });
  it('has a fixed v1 default and keeps typical configurations below 200 characters', () => {
    expect(encodeConfigHash(defaultConfig())).toBe('#v1.e30');
    for (const config of [blackTonneauPilot(), cushionPilot()]) {
      const encoded = encodeConfigHash(config);
      expect(encoded.length).toBeLessThanOrEqual(200);
      expect(decodeConfigHash(encoded, catalog)).toEqual({ config, notice: '' });
    }
  });

  it.each(catalog.rows)('$id: every catalog option survives a round trip', (row) => {
    for (const [index] of row.variants.entries()) {
      const config = applyVariant(defaultConfig(), row, index);
      const source = structuredClone(config);
      expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
      expect(config).toEqual(source);
    }
  });

  it('retains Unicode, custom colors, hidden settings, bits and complications', () => {
    const config = blackTonneauPilot();
    config.case.finish = 'pvd-black'; // Hidden while ceramic is selected.
    config.style = 'custom';
    config.movement = 'quartz';
    config.crown.guard = true;
    config.crown.screwed = false;
    config.crown.position = '4h30';
    config.bezel.type = 'rotating';
    config.bezel.insert = 'aluminium';
    config.bezel.scale = 'dive-60';
    config.bezel.color = '#0aB1c2';
    config.bezel.pip = 'triangle';
    config.crystal.coating = 'ar-blue';
    config.crystal.cyclops = true;
    config.dial.material = 'wood';
    config.dial.color = '#123abc';
    config.dial.pattern = 'circles';
    config.dial.indices.finish = 'printed';
    config.dial.indices.lume = 'c3';
    config.dial.text = { brand: 'Épure 東京 ⌚', line2: 'Série n° 01 — été', position: '6h' };
    config.hands.finish = 'blued';
    config.hands.lume = 'c1';
    config.hands.second.color = 'match';
    config.hands.second.counterweight = false;
    config.complications = [{ type: 'date', position: '3h', frame: true, discColor: 'white' }];
    config.strap = {
      type: 'fabric',
      material: 'canvas',
      color: '#aabbCC',
      stitching: null,
      widthMm: 18,
      buckle: 'folding',
    };
    config.view.lighting = 'warm-interior';
    config.view.night = true;
    const encoded = encodeConfigHash(config);
    expect(decodeConfigHash(encoded, catalog)).toEqual({ config, notice: '' });
    expect(encodeConfigHash(decodeConfigHash(encoded, catalog).config)).toBe(encoded);
  });

  it('does not depend on the order of rows or variants in the catalog', () => {
    const reordered = {
      ...catalog,
      rows: [...catalog.rows]
        .reverse()
        .map((row) => ({ ...row, variants: [...row.variants].reverse() })),
    };
    const config = blackTonneauPilot();
    expect(decodeConfigHash(encodeConfigHash(config), reordered)).toEqual({ config, notice: '' });
  });

  it('accepts new identifiers known to the current catalog without reassigning v1 tokens', () => {
    const next = structuredClone(catalog);
    next.rows
      .find((row) => row.id === 'hands')!
      .variants.push({
        id: 'new-style',
        value: 'new-style',
        preview: 'new.svg',
        i18n: { name: 'New' },
      });
    const config = defaultConfig();
    config.hands.set = 'new-style';
    expect(decodeConfigHash(encodeConfigHash(config), next)).toEqual({ config, notice: '' });
    expect(decodeConfigHash(encodeConfigHash(config), catalog).config.hands.set).toBe('sword');
  });

  it.each([
    '#v1.!!!',
    '#v1.a',
    '#v1.bnVsbA',
    '#v1.W10',
    '#v1.ew',
    '#v2.e30',
    '#v1.' + 'A'.repeat(16384),
  ])('handles malformed or unsupported links without throwing: %s', (encoded) => {
    const result = decodeConfigHash(encoded, catalog);
    expect(result.config).toEqual(defaultConfig());
    expect(result.notice).not.toBe('');
  });

  it('defaults invalid fields independently and ignores unknown keys', () => {
    const result = decodeConfigHash(
      hash({ a: 999, b: -5, c: 1000, x: '#oops', I: 4, l: 'yes', unknown: { anything: true } }),
      catalog,
    );
    const expected = defaultConfig();
    expected.hands.set = 'leaf';
    expect(result.config).toEqual(expected);
    expect(result.notice).not.toBe('');
    expect(Object.hasOwn(result.config, 'unknown')).toBe(false);
  });

  it('never treats unknown or prototype-named keys as object paths', () => {
    const result = decodeConfigHash(
      hash(JSON.parse('{"__proto__":{"polluted":true},"constructor":"bad","I":5}')),
      catalog,
    );
    expect(result.config.hands.set).toBe('breguet');
    expect(Object.hasOwn(result.config, 'polluted')).toBe(false);
    expect(Object.hasOwn({}, 'polluted')).toBe(false);
  });

  it('reads legacy pilot links, gives an explicit hash priority, and preserves unrelated parameters', () => {
    expect(readConfigUrl(new URL('https://example.test/?pilot=black'), catalog).config).toEqual(
      blackTonneauPilot(),
    );
    const source = new URL(
      `https://example.test/configurator?pilot=black&model=geometry${encodeConfigHash(cushionPilot())}`,
    );
    expect(readConfigUrl(source, catalog).config).toEqual(cushionPilot());
    const target = configUrl(cushionPilot(), source);
    expect(target.pathname).toBe('/configurator');
    expect(target.searchParams.get('model')).toBe('geometry');
    expect(target.searchParams.has('pilot')).toBe(false);
    expect(target.hash).toBe(encodeConfigHash(cushionPilot()));
    expect(source.searchParams.get('pilot')).toBe('black');
  });

  it('preserves the saved user configuration from the open browser', () => {
    const encoded =
      '#v1.eyJhIjozLCJiIjozNiwiYyI6MTAsImQiOjQyLjUsImUiOjE4LCJmIjo4LCJoIjozLCJqIjoxLCJzIjo1LCJ6Ijo0LCJBIjo4LCJEIjoyLCJFIjoxMCwiSSI6MSwiTSI6IiNGMkMyMzAifQ';
    const { config, notice } = decodeConfigHash(encoded, catalog);
    expect(notice).toBe('');
    expect(config.case).toMatchObject({
      shape: 'tonneau',
      material: 'steel',
      finish: 'polished',
      diameterMm: 36,
      thicknessMm: 10,
      lugToLugMm: 42.5,
      lugWidthMm: 18,
      lugs: 'none',
    });
    expect(config.crystal.type).toBe('acrylic');
    expect(config.dial.indices.numeralFont).toBe('futurist');
    expect(config.hands).toMatchObject({
      set: 'baton',
      second: { style: 'counterweight', color: '#F2C230' },
    });
  });
});
