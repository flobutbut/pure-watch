import { expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { visibleRows } from '../rules/visibility';
import { defaultConfig } from './defaults';
import { rehautColor } from './rehaut';
import { colorChoice, withColorChoice } from './colors';
import { decodeConfigHash, encodeConfigHash } from './url';

it('keeps independent colour, follows dial and case dynamically and retains both through URLs', () => {
  const catalog = parseCatalog(rawCatalog);
  let config = defaultConfig();
  const before = structuredClone(config);
  config = withColorChoice(config, 'rehaut', { color: '#C85432', finish: 'custom' });
  expect(rehautColor(config)).toBe('#C85432');
  expect(config.dial).toEqual(before.dial);
  expect(config.hands).toEqual(before.hands);
  expect(config.case).toEqual(before.case);
  config = withColorChoice(config, 'rehaut', { color: '#C85432', finish: 'dial' });
  config.dial.color = '#19476B';
  expect(rehautColor(config)).toBe('#19476B');
  config.rehaut.finish = 'metal';
  config.case.material = 'gold-yellow';
  expect(rehautColor(config)).toBe('#E6C068');
  expect(colorChoice(config, 'rehaut')).toEqual({
    color: '#C85432',
    finish: 'metal',
    graduationStyle: 'none',
    rehautProfile: 'classic',
  });
  expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
  expect(encodeConfigHash(defaultConfig())).toBe('#2');
  expect(decodeConfigHash('#v1.e30', catalog).config.rehaut).toEqual(before.rehaut);
});
it('keeps one flange row for every profile and preserves its graduation settings', () => {
  const rows = parseCatalog(rawCatalog).rows;
  const config = defaultConfig();
  const shown = () => visibleRows(rows, config).map((r) => r.id);
  expect(shown()).toContain('rehaut');
  expect(shown()).not.toContain('rehaut-scale');
  config.rehaut.profile = 'concave';
  config.rehaut.scale = '24h';
  expect(shown()).not.toContain('rehaut-scale');
  config.case.shape = 'rectangle';
  expect(shown()).toContain('rehaut');
  expect(shown()).not.toContain('rehaut-scale');
  config.dial.shape = 'rectangle';
  expect(shown()).not.toContain('rehaut-scale');
  expect(config.rehaut.scale).toBe('24h');
});

it('restaure ensemble le profil, la matière et les graduations sans modifier la piste des minutes', () => {
  const config = defaultConfig();
  config.details = {
    chapterRing: { dotSize: 0.27, radius: 0.96 },
    rehaut: { ink: '#C9A24A', tickLength: 1.3 },
  };
  config.rehaut.scale = '24h';
  const initial = colorChoice(config, 'rehaut');
  const next = withColorChoice(config, 'rehaut', {
    ...initial,
    rehautProfile: 'concave',
    finish: 'custom',
    color: '#19476B',
    graduationStyle: 'tachymeter',
  });
  expect(next.rehaut).toEqual({
    profile: 'concave',
    finish: 'custom',
    color: '#19476B',
    scale: 'tachymeter',
  });
  expect(next.dial).toBe(config.dial);
  expect(next.details?.chapterRing).toEqual(config.details.chapterRing);
  expect(withColorChoice(config, 'rehaut', initial)).toEqual(config);
  const catalog = parseCatalog(rawCatalog);
  expect(decodeConfigHash(encodeConfigHash(next), catalog)).toEqual({ config: next, notice: '' });
  for (const profile of ['classic', 'sloped', 'concave', 'stepped', 'flat']) {
    next.rehaut.profile = profile;
    const ids = visibleRows(catalog.rows, next).map((row) => row.id);
    expect(ids.filter((id) => id === 'rehaut')).toHaveLength(1);
    expect(ids).not.toContain('rehaut-scale');
    expect(ids).toContain('chapter-ring');
  }
});
