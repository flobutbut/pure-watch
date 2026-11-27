import { describe, expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { tint } from '../color/names';
import { RAL_CLASSIC } from '../color/ral';
import { RAL_NAMES_EN } from '../color/ral-en';
import { caseDimensionsError } from '../config/case-dimensions';
import { defaultConfig } from '../config/defaults';
import { compatibleMovements, mm } from '../movement/compatibility';
import { CATALOG_EN, localizeCatalog } from './catalog-en';
import { detectLocale, hourLabel } from './locale';

const catalog = parseCatalog(rawCatalog);
/** Names that read the same in both languages: sizes and numeral positions. */
const UNIVERSAL = /^[\d\s.,]+(mm)?$/;

describe('detectLocale', () => {
  it('keeps the first language the site speaks', () => {
    expect(detectLocale(['fr-FR', 'en-US'])).toBe('fr');
    expect(detectLocale(['en-GB', 'fr'])).toBe('en');
    expect(detectLocale(['de-DE', 'fr-CH'])).toBe('fr');
    expect(detectLocale(['FR'])).toBe('fr');
  });

  it('falls back to English', () => {
    expect(detectLocale(['de-DE', 'es'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });
});

describe('English catalogue', () => {
  it('names every row and variant', () => {
    for (const row of catalog.rows) {
      expect(CATALOG_EN[row.id], row.id).toBeDefined();
      if (row.i18n.hint) expect(CATALOG_EN[row.id]!.hint, `${row.id} hint`).toBeDefined();
      for (const variant of row.variants) {
        const name = CATALOG_EN[row.id]!.variants?.[variant.id];
        if (!name) expect(variant.i18n.name, `${row.id}/${variant.id}`).toMatch(UNIVERSAL);
      }
    }
  });

  it('only names identifiers that exist', () => {
    for (const [rowId, names] of Object.entries(CATALOG_EN)) {
      const row = catalog.rows.find((r) => r.id === rowId);
      expect(row, rowId).toBeDefined();
      for (const variantId of Object.keys(names.variants ?? {}))
        expect(
          row!.variants.some((v) => v.id === variantId),
          `${rowId}/${variantId}`,
        ).toBe(true);
    }
  });

  it('changes names only', () => {
    const english = localizeCatalog(catalog, 'en');
    expect(english.rows.map((r) => r.id)).toEqual(catalog.rows.map((r) => r.id));
    expect(english.rows[0]!.variants[0]!.value).toEqual(catalog.rows[0]!.variants[0]!.value);
    expect(english.rows.find((r) => r.id === 'case-shape')!.i18n.name).toBe('Case');
    expect(localizeCatalog(catalog, 'fr')).toBe(catalog);
  });
});

describe('English wording', () => {
  it('names every RAL tint', () => {
    for (const ral of RAL_CLASSIC) expect(RAL_NAMES_EN.get(ral.code), ral.code).toBeDefined();
  });

  it('names tints and numbers in the visitor’s language', () => {
    expect(tint('#1E3A6B', 'fr').name).not.toBe(tint('#1E3A6B', 'en').name);
    expect(tint('nope', 'en').name).toBe('Custom tone');
    expect(mm(28.5, 1, 'fr')).toBe('28,5 mm');
    expect(mm(28.5, 1, 'en')).toBe('28.5 mm');
    expect(hourLabel('4h30', 'fr')).toBe('4 h 30');
    expect(hourLabel('4h30', 'en')).toBe('4:30');
    expect(hourLabel('3h', 'en')).toBe('3 o’clock');
  });

  it('explains movements and dimension errors in English', () => {
    const config = defaultConfig();
    const tiny = { ...config, case: { ...config.case, diameterMm: 24, thicknessMm: 5 } };
    const notes = compatibleMovements(tiny, 'en').flatMap((fit) => fit.notes);
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) expect(note).not.toMatch(/[éèàç]|Boîtier|calibre qui/);
    expect(caseDimensionsError(config, { ...config.case, diameterMm: 99 }, 'en')).toBe(
      'Diameter: choose a value between 22 and 48 mm.',
    );
  });
});
