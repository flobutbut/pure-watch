import { describe, expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { applyVariant } from '../nav/selection';
import { defaultConfig } from './defaults';
import { decodeLinkPayload, encodeLinkPayload } from './link-codec';
import { normalizeDialFinish } from './dial';
import { cleanDetails, detailsSchema } from './details';
import { colorChoice, targetColor, withColorChoice, type ColorTarget } from './colors';
import { getAtPath, setAtPath } from './path';
import type { WatchConfig } from './types';
import { blackTonneauPilot, cushionPilot } from './pilot';
import {
  configUrl,
  decodeConfigHash,
  encodeConfigHash,
  opensPreview,
  readConfigUrl,
  shareUrl,
} from './url';

const catalog = parseCatalog(rawCatalog);
const hash = (payload: unknown) =>
  `#v1.${btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`;

describe('versioned watch links', () => {
  it('retains minute-dot size and independent colour through a shared link', () => {
    const base = defaultConfig();
    base.dial.chapterRing = 'dots';
    const config = withColorChoice(base, 'chapterRing', {
      ...colorChoice(base, 'chapterRing'),
      color: '#253F79',
      details: { chapterRing: { dotSize: 0.05 } },
    });
    expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
    expect(config.dial.chapterRingColor).toBe('#253F79');
    expect(detailsSchema.safeParse({ chapterRing: { dotSize: 0 } }).success).toBe(false);
    expect(detailsSchema.safeParse({ chapterRing: { dotSize: 3 } }).success).toBe(false);
    expect(
      encodeConfigHash(withColorChoice(base, 'chapterRing', colorChoice(base, 'chapterRing'))),
    ).toBe(encodeConfigHash(base));
  });
  it('retires the fumé choice while preserving v1 and v2 links and their independent effects', () => {
    expect(
      catalog.rows.find((r) => r.id === 'dial-finish')!.variants.some((v) => v.value === 'fume'),
    ).toBe(false);
    for (const w of [9, 'fume'])
      for (const link of [hash({ w, x: '#123ABC' }), encodeLinkPayload({ w, x: '#123ABC' })]) {
        const loaded = decodeConfigHash(link, catalog);
        expect(loaded.notice).toBe('');
        expect(loaded.config.dial).toMatchObject({ finish: 'sunburst', color: '#123ABC' });
        expect(loaded.config.details?.dial).toEqual({ fume: 1, legacyFume: true });
        expect(decodeConfigHash(encodeConfigHash(loaded.config), catalog)).toEqual(loaded);
        expect(decodeLinkPayload(encodeConfigHash(loaded.config))!.w).toBe(2);
      }
    const config = defaultConfig();
    config.dial.finish = 'fume';
    config.details = { dial: { fume: 0.35, edgeColor: '#172C3B' }, rehaut: { ink: '#F2F0EA' } };
    const migrated = normalizeDialFinish(config);
    expect(migrated.details).toEqual({
      dial: { fume: 0.35, edgeColor: '#172C3B', legacyFume: true },
      rehaut: { ink: '#F2F0EA' },
    });
    expect(config.dial.finish).toBe('fume');
    expect(normalizeDialFinish(migrated)).toBe(migrated);
  });
  it('retains the ring position, scale and insert colour without changing old links', () => {
    expect(decodeConfigHash('#v1.e30', catalog).config.bezel.angleDeg).toBe(0);
    const config = defaultConfig();
    Object.assign(config.bezel, {
      type: 'rotating',
      scale: '24h',
      color: '#254B3F',
      angleDeg: 153,
    });
    config.case.shape = 'square';
    config.dial.shape = 'square';
    expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
  });
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
  it('has a fixed default and keeps typical configurations below 80 characters', () => {
    expect(encodeConfigHash(defaultConfig())).toBe('#2');
    for (const config of [blackTonneauPilot(), cushionPilot()]) {
      const encoded = encodeConfigHash(config);
      expect(encoded.length).toBeLessThanOrEqual(80);
      // Letters, digits, - and _ only: messaging apps keep the whole link clickable.
      expect(encoded).toMatch(/^#2[A-Za-z0-9_-]*$/);
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
    config.hands.lumeColor = '#F0F0E8';
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

  it('carries the numeral size, position, colour and the bold typefaces', () => {
    const config = defaultConfig();
    config.dial.indices.numerals = 'all';
    config.dial.indices.numeralFont = 'black';
    config.dial.indices.numeralSize = 1.45;
    config.dial.indices.numeralRadius = 0.73;
    config.dial.indices.numeralColor = '#C9A24A';
    config.dial.indices.indexLength = 1.25;
    config.dial.indices.indexWidth = 0.8;
    config.dial.indices.indexRadius = 0.9;
    const back = decodeConfigHash(encodeConfigHash(config), catalog);
    expect(back.notice).toBe('');
    expect(back.config.dial.indices).toMatchObject({
      numeralFont: 'black',
      numeralSize: 1.45,
      numeralRadius: 0.73,
      numeralColor: '#C9A24A',
      indexLength: 1.25,
      indexWidth: 0.8,
      indexRadius: 0.9,
    });
    // Older links have none of these fields: the reference layout and ink are kept.
    const old = decodeConfigHash(encodeConfigHash(defaultConfig()), catalog).config;
    expect(old.dial.indices).toMatchObject({
      numeralSize: 1,
      numeralRadius: 1,
      numeralColor: 'match',
      indexLength: 1,
      indexWidth: 1,
      indexRadius: 1,
    });
    // Before the split, one index size scaled both directions: it still does.
    const legacy = decodeConfigHash(hash({ am: 1.3 }), catalog);
    expect(legacy.notice).toBe('');
    expect(legacy.config.dial.indices).toMatchObject({ indexLength: 1.3, indexWidth: 1.3 });
    const payload = decodeLinkPayload(encodeConfigHash(legacy.config));
    expect(payload).toMatchObject({ bc: 1.3, bd: 1.3 });
    expect(payload).not.toHaveProperty('am');
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

  it('opens shared links on the 3D preview, and only shared links', () => {
    const source = new URL(`https://example.test/configurator?model=geometry#v1.e30`);
    const shared = shareUrl(cushionPilot(), source);
    expect(opensPreview(shared)).toBe(true);
    expect(shared.searchParams.get('model')).toBe('geometry');
    expect(readConfigUrl(shared, catalog).config).toEqual(cushionPilot());
    // The address bar of the receiving page drops the marker once read.
    const own = configUrl(cushionPilot(), shared);
    expect(opensPreview(own)).toBe(false);
    expect(own.searchParams.get('model')).toBe('geometry');
    expect(opensPreview(configUrl(cushionPilot(), source))).toBe(false);
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

/** Same value, whatever the order of the keys. */
function same(a: unknown, b: unknown): boolean {
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
          )
        : value;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/** Every leaf of a configuration, as dotted paths (arrays count as one value). */
function leaves(value: unknown, prefix = ''): string[] {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return Object.entries(value).flatMap(([key, child]) =>
      leaves(child, prefix ? `${prefix}.${key}` : key),
    );
  return [prefix];
}

/** Another valid value for a leaf, within the link's bounds. */
function changed(path: string, value: unknown): unknown {
  if (typeof value === 'boolean') return !value;
  if (typeof value === 'number')
    return path === 'bezel.angleDeg' ? 42 : path === 'bezel.height' ? 1.2 : value * 0.95;
  if (typeof value === 'string' && /^#[\da-f]{6}$/i.test(value))
    return value.toUpperCase() === '#2A7F62' ? '#123456' : '#2A7F62';
  if (path === 'dial.text.brand' || path === 'dial.text.line2') return 'Épure ✦';
  if (path === 'dial.indices.lume' || path === 'hands.lume') return 'bgw9';
  if (path === 'complications') return [{ type: 'date', position: '3h' }];
  return value;
}

describe('every setting travels in the link', () => {
  // Lume colours follow the chosen pigment (a pigment is one value), and `schema` is the
  // format itself: neither is a free setting of its own.
  const TIED = new Set([
    'schema',
    'dial.indices.lumeColor',
    'dial.indices.lumeEmission',
    'hands.lumeColor',
    'hands.lumeEmission',
  ]);

  it('keeps each value of the configuration through a round trip', () => {
    const base = defaultConfig();
    const lost: string[] = [];
    for (const path of leaves(base)) {
      if (TIED.has(path)) continue;
      const next = changed(path, getAtPath(base, path));
      const config = setAtPath(base, path, next) as WatchConfig;
      const back = getAtPath(decodeConfigHash(encodeConfigHash(config), catalog).config, path);
      if (!same(back, next)) lost.push(path);
    }
    expect(lost).toEqual([]);
  });

  it('keeps every variant of every row of the catalog', () => {
    const lost: string[] = [];
    for (const row of catalog.rows)
      row.variants.forEach((variant, index) => {
        const config = applyVariant(defaultConfig(), row, index);
        const back = decodeConfigHash(encodeConfigHash(config), catalog);
        const sent = getAtPath(config, row.path);
        if (back.notice !== '' || !same(getAtPath(back.config, row.path), sent))
          lost.push(`${row.id}/${variant.id}`);
      });
    expect(lost).toEqual([]);
  });

  it('keeps a pigment with its day and night colours', () => {
    const config = defaultConfig();
    config.hands.lume = 'bgw9';
    config.dial.indices.lume = 'old-radium';
    const back = decodeConfigHash(encodeConfigHash(config), catalog).config;
    expect(back.hands.lume).toBe('bgw9');
    expect(back.dial.indices.lume).toBe('old-radium');
    expect(back.hands.lumeColor).not.toBe(back.dial.indices.lumeColor);
  });

  it('shows after the link the colour each panel showed', () => {
    const targets: ColorTarget[] = [
      'dial',
      'hands',
      'seconds',
      'rehaut',
      'numerals',
      'indices',
      'chapterRing',
      'bezel',
      'lugs',
    ];
    for (const target of targets)
      for (const finish of target === 'rehaut' ? ['custom', 'dial', 'metal'] : [undefined]) {
        const base = defaultConfig();
        base.dial.indices.numerals = 'all';
        base.rehaut.profile = 'sloped';
        const choice = {
          ...colorChoice(base, target),
          color: '#2A7F62' as const,
          ...(finish ? { finish } : {}),
        };
        const config = withColorChoice(base, target, choice);
        const back = decodeConfigHash(encodeConfigHash(config), catalog).config;
        expect([target, finish, targetColor(back, target)]).toEqual([
          target,
          finish,
          targetColor(config, target),
        ]);
      }
  });

  // `details` (anneau, sous-cadrans, réserve, surface du cadran, réhaut, index, points de
  // la piste) n'existe pas dans la configuration par défaut : ses réglages sont générés
  // depuis le schéma, un par un, pour qu'un ajout oublié ou mal borné fasse échouer le test.
  it('keeps each detailed setting, read from the schema', () => {
    const variants = schemaVariants(detailsSchema) as Record<string, unknown>[];
    // Chaque section du schéma est parcourue.
    expect(new Set(variants.flatMap(Object.keys))).toEqual(
      new Set(Object.keys(detailsSchema.shape)),
    );
    const lost: string[] = [];
    for (const details of variants) {
      const config = { ...defaultConfig(), details } as WatchConfig;
      const back = decodeConfigHash(encodeConfigHash(config), catalog);
      const sent = cleanDetails(detailsSchema.parse(details));
      if (back.notice !== '' || !same(back.config.details, sent))
        lost.push(JSON.stringify(details));
    }
    expect(lost).toEqual([]);
  });

  it('keeps the optional strap settings', () => {
    const lost: string[] = [];
    const options = {
      length: ['short', 'long'],
      taperMm: [0, 2.5, 6],
      buckleFinish: ['steel', 'gold-yellow', 'gold-rose', 'black'],
    };
    for (const [key, values] of Object.entries(options))
      for (const value of values) {
        const config = setAtPath(defaultConfig(), `strap.${key}`, value) as WatchConfig;
        const back = decodeConfigHash(encodeConfigHash(config), catalog);
        if (back.notice !== '' || getAtPath(back.config, `strap.${key}`) !== value)
          lost.push(`${key}=${value}`);
      }
    expect(lost).toEqual([]);
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any -- walks zod's internal definitions */
/** A valid value for a schema, with only its required fields. */
function schemaMinimal(schema: any): unknown {
  return schemaVariants(schema)[0];
}

/** Valid values for a schema, each one exercising a different leaf or option. */
function schemaVariants(schema: any): unknown[] {
  const def = schema._zod.def;
  switch (def.type) {
    case 'optional':
    case 'nullable':
      return schemaVariants(def.innerType);
    case 'pipe':
      return schemaVariants(def.in);
    case 'object': {
      const required = Object.fromEntries(
        Object.entries(def.shape as Record<string, any>)
          .filter(([, child]) => !['optional', 'nullable'].includes(child._zod.def.type))
          .map(([key, child]) => [key, schemaMinimal(child)]),
      );
      return Object.entries(def.shape as Record<string, any>).flatMap(([key, child]) =>
        schemaVariants(child).map((value) => ({ ...required, [key]: value })),
      );
    }
    case 'record':
      return schemaVariants(def.valueType).map((value) => ({ '3': value }));
    case 'union':
      return (def.options as any[]).flatMap(schemaVariants);
    case 'enum':
      return Object.values(def.entries);
    case 'literal':
      return [...def.values];
    case 'number': {
      const min = Number.isFinite(schema.minValue) ? schema.minValue : 0;
      const max = Number.isFinite(schema.maxValue) ? schema.maxValue : 1;
      return [min, Math.round((min + (max - min) * 0.37) * 1000) / 1000, max];
    }
    case 'string':
      // A colour or a short label, whichever the string's format accepts.
      return ['#2A7F62', 'Épure'].filter((value) => schema.safeParse(value).success);
    case 'custom':
      return ['sunburst'];
    default:
      throw new Error(`Schéma non parcouru : ${def.type}`);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
