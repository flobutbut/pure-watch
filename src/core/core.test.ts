import { describe, expect, it } from 'vitest';
import rawCatalog from '../data/catalog.json';
import { CatalogError, parseCatalog } from './catalog/load';
import { handAngles, POSTER_TIME, stepsPerSecond } from './clock/angles';
import { defaultConfig } from './config/defaults';
import { getAtPath, matchesValue, setAtPath } from './config/path';
import { applyVariant, selectionFromConfig } from './nav/selection';

describe('catalogue', () => {
  it("le catalogue est valide et suit l'ordre du regard (spec §5)", () => {
    const catalog = parseCatalog(rawCatalog);
    expect(catalog.rows.map((r) => r.id)).toEqual([
      'case-shape',
      'case-size',
      'lugs',
      'case-material',
      'case-finish',
      'crown',
      'crown-position',
      'bezel',
      'crystal',
      'rehaut',
      'rehaut-scale',
      'dial-shape',
      'dial-finish',
      'dial-color',
      'chapter-ring',
      'indices',
      'numerals',
      'numeral-font',
      'hands',
      'seconds',
      'seconds-color',
    ]);
  });

  it('refuse les identifiants en double et non kebab-case', () => {
    const bad = {
      catalogVersion: '0',
      rows: [
        {
          id: 'Hands',
          group: 'hands',
          kind: 'enum',
          path: 'hands.set',
          previewContext: 'dark-disc',
          priority: 'P0',
          i18n: { name: 'Aiguilles' },
          variants: [
            { id: 'a', value: 'a', preview: 'a.svg', i18n: { name: 'A' } },
            { id: 'a', value: 'b', preview: 'b.svg', i18n: { name: 'B' } },
          ],
        },
      ],
    };
    expect(() => parseCatalog(bad)).toThrow(CatalogError);
    expect(() => parseCatalog(bad)).toThrow(/kebab-case/);
    expect(() => parseCatalog(bad)).toThrow(/double/);
  });
});

describe('chemins dans la configuration', () => {
  it('écrit sans modifier la source et partage les branches intactes', () => {
    const config = defaultConfig();
    const next = setAtPath(config, 'hands.set', 'leaf');
    expect(next.hands.set).toBe('leaf');
    expect(config.hands.set).toBe('sword');
    expect(next.case).toBe(config.case);
  });

  it('fusionne une valeur objet au lieu de remplacer', () => {
    const next = setAtPath(defaultConfig(), 'dial', { finish: 'iridescent-oil', color: '#2B2F3A' });
    expect(next.dial.finish).toBe('iridescent-oil');
    expect(next.dial.chapterRing).toBe('railroad');
  });

  it('reconnaît une variante objet par inclusion', () => {
    const config = defaultConfig();
    expect(matchesValue(getAtPath(config, 'dial'), { finish: 'matte', color: '#111317' })).toBe(
      true,
    );
    expect(matchesValue(getAtPath(config, 'dial'), { finish: 'matte', color: '#FFFFFF' })).toBe(
      false,
    );
  });
});

describe('sélection ↔ configuration', () => {
  const catalog = parseCatalog(rawCatalog);

  it('déduit la sélection de la configuration (aller-retour)', () => {
    const hands = catalog.rows.find((r) => r.id === 'hands')!;
    const size = catalog.rows.find((r) => r.id === 'case-size')!;
    let config = applyVariant(defaultConfig(), hands, 4);
    config = applyVariant(config, size, 12);
    expect(config.hands.set).toBe('breguet');
    expect(config.case.diameterMm).toBe(46);

    const selection = selectionFromConfig(catalog, config);
    expect(selection['hands']).toBe(4);
    expect(selection['case-size']).toBe(12);
    expect(selection['dial-finish']).toBe(0); // mat
    expect(selection['dial-color']).toBe(0); // noir
    expect(selection['seconds']).toBe(1); // à contrepoids
  });
});

describe('angles des aiguilles', () => {
  it('10 h 10 min 35 s en balayage', () => {
    expect(handAngles(POSTER_TIME, 0)).toEqual({
      hour: 300 + 0.5 * (10 + 35 / 60),
      minute: 6 * (10 + 35 / 60),
      second: 210,
    });
  });

  it("l'aiguille des heures avance avec les minutes", () => {
    expect(handAngles({ h: 3, m: 30, s: 0 }, 0).hour).toBe(105);
    expect(handAngles({ h: 15, m: 0, s: 0 }, 0).hour).toBe(90);
  });

  it('quantifie la trotteuse à la cadence du NH35 (6 pas/s)', () => {
    const pps = stepsPerSecond(21_600);
    expect(pps).toBe(6);
    expect(handAngles({ h: 0, m: 0, s: 1.1 }, pps).second).toBeCloseTo(6);
    expect(handAngles({ h: 0, m: 0, s: 1.2 }, pps).second).toBeCloseTo(7);
  });

  it('quartz : un pas par seconde', () => {
    expect(handAngles({ h: 0, m: 0, s: 12.9 }, 1).second).toBe(72);
  });
});
