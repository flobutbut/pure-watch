import { expect, it } from 'vitest';
import rawCatalog from './data/catalog.json';
import { parseCatalog } from './core/catalog/load';
import { defaultConfig } from './core/config/defaults';
import { detailsSchema, indexAt } from './core/config/details';
import { colorChoice, withColorChoice } from './core/config/colors';
import { decodeConfigHash, encodeConfigHash } from './core/config/url';
import { reserveGauge } from './core/config/power-reserve';
import { rehautPrintSvg } from './render2d/rehaut-print';
import { watchDimensions } from './core/geometry/dimensions';
import { reserveSvg } from './render3d/parts/power-reserve';
import { detailTraits } from './ui/identity/detail-traits';

const catalog = parseCatalog(rawCatalog);
it('preserves every detail in a shared link without modifying historic links', () => {
  const config = defaultConfig();
  expect(encodeConfigHash(config)).toBe('#2');
  expect(encodeConfigHash(withColorChoice(config, 'indices', colorChoice(config, 'indices')))).toBe(
    '#2',
  );
  config.details = {
    dial: { fume: 0.7, edgeColor: '#172C3B', grainSize: 0.7, grainDepth: 0.5, grainRoughness: 1.1 },
    rehaut: { ink: '#173445', accent: '#E58B42', accentAt: 'zero', labelSize: 1.2, lineWidth: 1.1 },
    indices: {
      '12': { style: 'triangles', indexLength: 1.4, finish: 'applied-gold', lume: 'bgw9' },
      '3': { style: 'dots', lume: null },
    },
    reserve: {
      size: 1.2,
      offsetX: 0.1,
      offsetY: -0.05,
      ink: '#F2F0EA',
      lowColor: '#E58B42',
      handColor: '#E58B42',
      label: 'AUTONOMIE',
    },
  };
  expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
  expect(detailTraits('dial-finish', config, 'fr')).toContainEqual({
    label: 'Intensité du fumé',
    value: '70 %',
  });
  expect(decodeConfigHash('#v1.e30', catalog).config.details).toBeUndefined();
});

it('rejects malformed detail values and unbounded index maps', () => {
  expect(detailsSchema.safeParse({ dial: { fume: 4 } }).success).toBe(false);
  expect(detailsSchema.safeParse({ indices: { '13': { style: 'triangles' } } }).success).toBe(
    false,
  );
  expect(detailsSchema.safeParse({ rehaut: { ink: 'red<script>' } }).success).toBe(false);
  const hash =
    '#v1.' + btoa(JSON.stringify({ bf: { reserve: { size: 2000 } } })).replace(/=+$/, '');
  expect(decodeConfigHash(hash, catalog).notice).toBe('adjusted');
});

it('overrides only one index and restores its own luminous pigment', () => {
  const config = defaultConfig();
  config.details = { indices: { '12': { style: 'triangles', lume: 'bgw9', indexLength: 1.4 } } };
  const twelve = indexAt(config, 0);
  expect(twelve.dial.indices).toMatchObject({
    style: 'triangles',
    lume: 'bgw9',
    lumeEmission: '#65CAFF',
    indexLength: 1.4,
  });
  expect(indexAt(config, 3)).toBe(config);
  expect(config.dial.indices.style).toBe('baton');
});

it('prints independent rehaut colours and a single highlighted starting marker', () => {
  const config = defaultConfig();
  Object.assign(config.rehaut, { profile: 'sloped', scale: 'five-minute' });
  config.details = { rehaut: { ink: '#123456', accent: '#E58B42', accentAt: 'zero' } };
  const svg = rehautPrintSvg(config, watchDimensions(config));
  expect(svg).toContain('stroke="#123456" fill="#123456"');
  expect(svg.match(/fill="#E58B42"/g)).toHaveLength(1);
  expect(svg).toMatch(/fill="#E58B42">60<\/text>/);
});

it('moves and scales the reserve within the dial and escapes custom inscriptions', () => {
  const config = defaultConfig();
  config.complications = [{ type: 'power-reserve', position: '6h' }];
  const before = reserveGauge(config, 15)!;
  config.details = {
    reserve: { size: 1.4, offsetX: 0.2, offsetY: -0.2, lowColor: '#E58B42', label: '<A&B>' },
  };
  const after = reserveGauge(config, 15)!;
  expect(after.r).toBeCloseTo(before.r * 1.4);
  expect(Math.hypot(after.x, after.y + after.r * 0.45) + after.r * 0.9).toBeLessThanOrEqual(15);
  const svg = reserveSvg(
    4,
    'arc',
    '#ffffff',
    { family: 'Arial', weight: 400 },
    '',
    config.details.reserve,
  );
  expect(svg).toContain('&lt;A&amp;B&gt;');
  expect(
    reserveSvg(4, 'fuel', '#ffffff', { family: 'Arial', weight: 400 }, '', config.details.reserve),
  ).toContain('#E58B42');
});
