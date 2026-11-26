import { describe, expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { defaultConfig } from './defaults';
import { applyVariant } from '../nav/selection';
import { colorChoice, withColorChoice } from './colors';
import { decodeConfigHash, encodeConfigHash } from './url';
import { strapSettings, STRAP_TYPES, STRAP_STYLES } from './strap';
import { withCaseDimensions, caseDimensions } from './case-dimensions';
const catalog = parseCatalog(rawCatalog);
const row = catalog.rows.find((r) => r.id === 'strap')!;

describe('bracelet', () => {
  it('quatre matières avec des formes compatibles et une largeur liée aux cornes', () => {
    for (const [i, type] of STRAP_TYPES.entries()) {
      const config = applyVariant(defaultConfig(), row, i);
      expect(config.strap.type).toBe(type);
      expect(STRAP_STYLES[type]).toContain(strapSettings(config).material);
      const resized = withCaseDimensions(config, { ...caseDimensions(config), lugWidthMm: 22 });
      expect(strapSettings(resized).widthMm).toBe(22);
      expect(resized.strap.widthMm).toBe(22);
    }
  });
  it('conserve les réglages à la resélection et les sauvegarde dans le lien', () => {
    let config = applyVariant(defaultConfig(), row, 0);
    config = withColorChoice(config, 'strap', {
      ...colorChoice(config, 'strap'),
      strap: {
        ...config.strap,
        material: 'five-link',
        length: 'long',
        taperMm: 6,
        buckleFinish: 'gold-rose',
        color: '#252A30',
      },
    });
    expect(applyVariant(config, row, 0)).toEqual(config);
    const decoded = decodeConfigHash(encodeConfigHash(config), catalog);
    expect(decoded.notice).toBe('');
    expect(decoded.config).toEqual(config);
    const rubber = applyVariant(config, row, 1);
    expect(rubber.strap.buckleFinish).toBe('gold-rose');
    expect(rubber.strap.length).toBe('long');
    expect(rubber.strap.material).toBe('smooth');
  });
  it('lit les anciens liens sans changer leur contenu et applique des défauts de rendu', () => {
    const config = defaultConfig();
    expect(decodeConfigHash(encodeConfigHash(config), catalog).config).toEqual(config);
    expect(strapSettings(config)).toMatchObject({
      material: 'grained',
      length: 'standard',
      buckleFinish: 'case',
      taperMm: 4,
    });
  });
});
