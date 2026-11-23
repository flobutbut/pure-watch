import { describe, expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../../core/catalog/load';
import { defaultConfig } from '../../core/config/defaults';
import { visibleRows } from '../../core/rules/visibility';
import { identitySections } from './identity';

const catalog = parseCatalog(rawCatalog);

describe('fiche d’identité', () => {
  it('donne les cotes puis les pièces de la grille, couleurs comprises', () => {
    const config = defaultConfig();
    const sections = identitySections(visibleRows(catalog.rows, config), config);
    expect(sections.map((s) => s.title)).toEqual(['Dimensions', 'Boîtier', 'Cadran', 'Aiguilles']);
    expect(sections[0]!.traits[0]).toEqual({ label: 'Diamètre', value: '40 mm' });
    const all = sections.flatMap((s) => s.traits);
    expect(all.find((t) => t.label === 'Taille')).toBeUndefined();
    expect(all.find((t) => t.label === 'Aiguilles')?.value).toBe('Épée');
    expect(all.find((t) => t.label === 'Matière des aiguilles')).toMatchObject({
      value: 'Acier',
      metal: true,
    });
    expect(all.find((t) => t.label === 'Couleur du cadran')?.value).toBe('#111317');
  });

  it('donne la valeur réellement portée par la montre', () => {
    const config = defaultConfig();
    config.bezel = { ...config.bezel, type: 'rotating', scale: 'none' };
    config.dial.shape = 'cushion';
    const all = identitySections(visibleRows(catalog.rows, config), config).flatMap(
      (s) => s.traits,
    );
    expect(all.find((t) => t.label === 'Graduation de lunette')?.value).toBe('Plongée · 60 min');
    expect(all.find((t) => t.label === 'Couleur de la lunette')?.swatch).toBe('#101418');
    const shape = all.find((t) => t.label === 'Forme du cadran');
    if (shape) expect(shape.value).toBe('Rond');
  });

  it('montre la couleur libre de la trotteuse et une valeur hors catalogue', () => {
    const config = defaultConfig();
    config.hands.second.color = '#2255AA';
    config.case.diameterMm = 41;
    const sections = identitySections(visibleRows(catalog.rows, config), config);
    const all = sections.flatMap((s) => s.traits);
    expect(all.find((t) => t.label === 'Couleur de la trotteuse')).toMatchObject({
      value: '#2255AA',
      swatch: '#2255AA',
    });
    expect(all.find((t) => t.label === 'Diamètre')?.value).toBe('41 mm');
  });
});
