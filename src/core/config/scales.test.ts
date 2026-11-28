import { expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { visibleRows } from '../rules/visibility';
import { defaultConfig } from './defaults';
import { colorChoice, targetColor, withColorChoice } from './colors';
import { decodeConfigHash, encodeConfigHash } from './url';
import { detailsSchema } from './details';

const catalog = parseCatalog(rawCatalog);
it('conserve deux lignes et deux panneaux indépendants, même sans graduations', () => {
  const config = defaultConfig();
  config.rehaut.profile = 'sloped';
  config.dial.chapterRing = 'none';
  expect(visibleRows(catalog.rows, config).map((row) => row.id)).toEqual(
    expect.arrayContaining(['chapter-ring', 'rehaut']),
  );
});
it('règle le style, la géométrie et les accents de minuterie sans modifier le réhaut', () => {
  const config = defaultConfig();
  const next = withColorChoice(config, 'chapterRing', {
    ...colorChoice(config, 'chapterRing'),
    graduationStyle: 'ticks',
    color: '#C9A24A',
    details: {
      chapterRing: {
        lineWidth: 1.4,
        length: 1.3,
        minor: { length: 0.7, dotSize: 0.5, span: 0 },
        major: { lineWidth: 1.8, dotSize: 1.2, span: 1 },
        radius: 0.85,
        position: 1,
        accentAt: 'quarters',
        accent: '#D7262E',
      },
    },
  });
  expect(next.rehaut).toBe(config.rehaut);
  expect(next.hands).toBe(config.hands);
  expect(next.dial.indices).toBe(config.dial.indices);
  expect(next.dial.chapterRing).toBe('ticks');
  expect(targetColor(next, 'chapterRing')).toBe('#C9A24A');
  expect(decodeConfigHash(encodeConfigHash(next), catalog)).toEqual({ config: next, notice: '' });
});
it('sépare les inscriptions du réhaut de sa matière et de la piste des minutes', () => {
  const config = defaultConfig();
  config.rehaut = { ...config.rehaut, profile: 'concave', finish: 'custom', color: '#19476B' };
  const initial = colorChoice(config, 'rehautScale');
  const next = withColorChoice(config, 'rehautScale', {
    ...initial,
    graduationStyle: '24h',
    details: { rehaut: { ink: '#C9A24A', tickLength: 1.5, labelSize: 1.2, lineWidth: 0.8 } },
  });
  expect(next.dial).toBe(config.dial);
  expect(next.rehaut).toEqual({ ...config.rehaut, scale: '24h' });
  expect(targetColor(next, 'rehautScale')).toBe('#C9A24A');
  expect(decodeConfigHash(encodeConfigHash(next), catalog)).toEqual({ config: next, notice: '' });
  expect(withColorChoice(config, 'rehautScale', initial)).toEqual(config);
});
it('ouvrir puis fermer les deux panneaux préserve le lien par défaut et les anciens liens', () => {
  for (const target of ['chapterRing', 'rehautScale'] as const) {
    const config = defaultConfig();
    expect(encodeConfigHash(withColorChoice(config, target, colorChoice(config, target)))).toBe(
      '#2',
    );
    const old = decodeConfigHash('#v1.' + btoa(JSON.stringify({ z: 3, ac: 2, af: 4 })), catalog);
    expect(old.notice).toBe('');
    expect(old.config.dial.chapterRing).toBe('dots');
    expect(old.config.rehaut.scale).toBe('24h');
    expect(decodeConfigHash(encodeConfigHash(old.config), catalog).config).toEqual(old.config);
  }
});
it('valide les bornes des réglages sans modifier les anciennes données', () => {
  expect(detailsSchema.safeParse({ chapterRing: { dotSize: 1.3 } }).success).toBe(true);
  expect(
    detailsSchema.safeParse({ chapterRing: { position: 0, major: { span: 1 } } }).success,
  ).toBe(true);
  for (const value of [
    { chapterRing: { radius: 1.5 } },
    { chapterRing: { lineWidth: 0 } },
    { chapterRing: { minor: { length: 2 } } },
    { chapterRing: { major: { dotSize: 0 } } },
    { chapterRing: { minor: { span: 1.01 } } },
    { chapterRing: { position: -0.01 } },
    { chapterRing: { accentAt: 'hours' } },
    { rehaut: { tickLength: 3 } },
  ])
    expect(detailsSchema.safeParse(value).success).toBe(false);
});

it('garde le même lien au rechargement quel que soit l’ordre des réglages édités', () => {
  const config = defaultConfig();
  config.details = {
    rehaut: { tickLength: 1.3, lineWidth: 1.4, ink: '#C9A24A', accentAt: 'quarters' },
    chapterRing: { length: 1.4, lineWidth: 1.6, radius: 0.85 },
  };
  const hash = encodeConfigHash(config);
  const loaded = decodeConfigHash(hash, catalog);
  expect(loaded.notice).toBe('');
  expect(encodeConfigHash(loaded.config)).toBe(hash);
  const reordered: typeof config = {
    ...config,
    details: {
      chapterRing: { radius: 0.85, length: 1.4, lineWidth: 1.6 },
      rehaut: { ink: '#C9A24A', accentAt: 'quarters' as const, lineWidth: 1.4, tickLength: 1.3 },
    },
  };
  expect(encodeConfigHash(reordered)).toBe(hash);
});
