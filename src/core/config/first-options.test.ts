import { describe, expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { applyVariant, variantIndexFromConfig } from '../nav/selection';
import { caseDimensions, caseDimensionsError, withCaseDimensions } from './case-dimensions';
import { defaultConfig } from './defaults';
import { decodeConfigHash, encodeConfigHash } from './url';

const catalog = parseCatalog(rawCatalog);
const choose = (config: ReturnType<typeof defaultConfig>, rowId: string, id: string) => {
  const row = catalog.rows.find((r) => r.id === rowId)!;
  return applyVariant(
    config,
    row,
    row.variants.findIndex((v) => v.id === id),
  );
};

describe('affichage sans secondes', () => {
  it('restaure aussi les liens qui indiquent seulement Sans trotteuse, sans drapeau de contrepoids', () => {
    const hash = '#v1.' + btoa(JSON.stringify({ L: 11 })).replace(/=+$/, '');
    const { config, notice } = decodeConfigHash(hash, catalog);
    expect(notice).toBe('');
    const row = catalog.rows.find((r) => r.id === 'seconds')!;
    expect(row.variants[variantIndexFromConfig(row, config)]!.id).toBe('none');
    expect(config.hands.second.counterweight).toBe(false);
  });
  it('retire les complications à secondes et garde la date, la réserve et la couleur mémorisée', () => {
    const config = defaultConfig();
    config.complications = [
      { type: 'date', position: '3h' },
      { type: 'power-reserve', position: '12h' },
      { type: 'small-seconds', position: '6h' },
      { type: 'chronograph', position: 'bicompax' },
    ];
    const next = choose(config, 'seconds', 'none');
    expect(next.complications.map((c) => c.type)).toEqual(['date', 'power-reserve']);
    expect(next.hands.second).toMatchObject({ style: 'none', color: '#F0561D' });
    expect(config.complications).toHaveLength(4);
    expect(decodeConfigHash(encodeConfigHash(next), catalog)).toEqual({ config: next, notice: '' });
  });

  it.each([
    ['chronograph', 'tricompax'],
    ['small-seconds', '9h'],
  ])('restaure une aiguille quand on ajoute %s', (row, variant) => {
    const none = choose(defaultConfig(), 'seconds', 'none');
    const restored = choose(none, row, variant);
    expect(restored.hands.second.style).toBe('thin');
    expect(restored.complications).toContainEqual({ type: row, position: variant });
  });
});

describe('dimensions sur mesure', () => {
  it('change les cotes indépendamment et conserve les valeurs exactes dans le lien', () => {
    const config = defaultConfig();
    const values = { diameterMm: 41, thicknessMm: 13.54, lugToLugMm: 47.5, lugWidthMm: 21 };
    const next = withCaseDimensions(config, values);
    expect(caseDimensions(next)).toEqual(values);
    expect(next.strap.widthMm).toBe(21);
    expect(next.dial).toBe(config.dial);
    expect(config.case.diameterMm).toBe(40);
    expect(decodeConfigHash(encodeConfigHash(next), catalog)).toEqual({ config: next, notice: '' });
    const thicker = withCaseDimensions(next, { ...values, thicknessMm: 14 });
    expect(caseDimensions(thicker)).toEqual({ ...values, thicknessMm: 14 });
    const row = catalog.rows.find((r) => r.id === 'case-size')!;
    expect(row.variants[variantIndexFromConfig(row, next)]!.id).toBe('40-mm');
  });

  it('ignore les saisies incomplètes et les dimensions qui croiseraient le boîtier', () => {
    const config = defaultConfig();
    for (const values of [
      { ...caseDimensions(config), thicknessMm: NaN },
      { ...caseDimensions(config), diameterMm: 0 },
      { ...caseDimensions(config), lugToLugMm: 25 },
      { ...caseDimensions(config), diameterMm: 22, lugWidthMm: 30 },
    ]) {
      expect(caseDimensionsError(config, values)).not.toBe('');
      expect(withCaseDimensions(config, values)).toBe(config);
    }
  });
});
