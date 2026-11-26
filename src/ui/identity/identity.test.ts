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
    expect(sections.map((s) => s.title)).toEqual([
      'Dimensions',
      'Boîtier',
      'Cadran',
      'Aiguilles',
      'Complications',
      'Bracelet',
    ]);
    expect(sections[0]!.traits[0]).toEqual({ label: 'Diamètre', value: '40 mm' });
    const all = sections.flatMap((s) => s.traits);
    expect(all.find((t) => t.label === 'Taille')).toBeUndefined();
    expect(all.find((t) => t.label === 'Aiguilles')?.value).toBe('Épée');
    expect(all.find((t) => t.label === 'Matière des aiguilles')).toMatchObject({
      value: 'Acier',
      metal: true,
    });
    expect(all.find((t) => t.label === 'Couleur du cadran')).toMatchObject({
      value: 'Noir',
      swatch: '#111317',
      reference: '≈ RAL 9005 Noir foncé',
    });
  });

  it('détaille l’écriture, la taille, la position et la couleur sous la disposition des chiffres', () => {
    const config = defaultConfig();
    expect(
      identitySections(visibleRows(catalog.rows, config), config)
        .flatMap((s) => s.traits)
        .find((t) => t.label === 'Taille des chiffres'),
    ).toBeUndefined();
    config.dial.indices.numerals = 'all';
    config.dial.indices.numeralSize = 1.3;
    config.dial.indices.numeralColor = '#D7262E';
    const all = identitySections(visibleRows(catalog.rows, config), config).flatMap(
      (s) => s.traits,
    );
    const labels = all.map((t) => t.label);
    const style = labels.indexOf('Chiffres');
    expect(labels.slice(style, style + 5)).toEqual([
      'Chiffres',
      'Écriture des chiffres',
      'Taille des chiffres',
      'Position des chiffres',
      'Couleur des chiffres',
    ]);
    expect(all.find((t) => t.label === 'Taille des chiffres')?.value).toBe(
      '130 % de la taille standard',
    );
    expect(all.find((t) => t.label === 'Position des chiffres')?.value).toBe('Standard');
    expect(all.find((t) => t.label === 'Couleur des chiffres')?.swatch).toBe('#D7262E');
  });

  it('détaille la longueur, la largeur et la position des index', () => {
    const config = defaultConfig();
    config.dial.indices.indexRadius = 0.85;
    config.dial.indices.indexWidth = 1.3;
    const all = identitySections(visibleRows(catalog.rows, config), config).flatMap(
      (s) => s.traits,
    );
    expect(all.find((t) => t.label === 'Longueur des index')?.value).toBe('Standard');
    expect(all.find((t) => t.label === 'Largeur des index')?.value).toBe(
      '130 % de la largeur standard',
    );
    expect(all.find((t) => t.label === 'Position des index')?.value).toBe(
      '85 % de la distance standard',
    );
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

  it('ne donne pas de RAL pour une teinte de finition', () => {
    const config = defaultConfig();
    config.dial.finish = 'sunburst';
    config.dial.color = '#1E3A6B';
    const all = identitySections(visibleRows(catalog.rows, config), config).flatMap(
      (s) => s.traits,
    );
    expect(all.find((t) => t.label === 'Couleur du cadran')).toMatchObject({
      value: 'Bleu nuit',
      reference: 'Teinte de finition, à valider sur échantillon',
    });
  });

  it('montre la couleur libre de la trotteuse et une valeur hors catalogue', () => {
    const config = defaultConfig();
    config.hands.second.color = '#2255AA';
    config.case.diameterMm = 41;
    config.case.thicknessMm = 13.54;
    const sections = identitySections(visibleRows(catalog.rows, config), config);
    const all = sections.flatMap((s) => s.traits);
    const seconds = all.find((t) => t.label === 'Couleur de la trotteuse');
    expect(seconds).toMatchObject({
      swatch: '#2255AA',
      reference: expect.stringMatching(/^≈ RAL 5\d{3}/),
    });
    expect(seconds?.value).not.toMatch(/#/);
    expect(all.find((t) => t.label === 'Diamètre')?.value).toBe('41 mm');
    expect(all.find((t) => t.label === 'Épaisseur')?.value).toBe('13,54 mm');
  });

  it('montre la date avec ses valeurs par défaut', () => {
    const config = defaultConfig();
    config.complications = [{ type: 'date', position: '3h' }];
    const traits = identitySections(visibleRows(catalog.rows, config), config).find(
      (s) => s.title === 'Complications',
    )!.traits;
    expect(traits.map((t) => `${t.label} : ${t.value}`)).toEqual([
      'Date : À 3 h',
      'Guichet de date : Cerclé',
      'Disque de date : Blanc',
      'Loupe de date : Sans loupe',
      'Petite seconde : Trotteuse au centre',
      'Réserve de marche : Sans indicateur',
      'Chronographe : Sans chronographe',
    ]);
  });

  it('montre la petite seconde avec son style par défaut', () => {
    const config = defaultConfig();
    config.complications = [{ type: 'small-seconds', position: '6h' }];
    const traits = identitySections(visibleRows(catalog.rows, config), config)
      .find((s) => s.title === 'Complications')!
      .traits.map((t) => `${t.label} : ${t.value}`);
    expect(traits).toContain('Petite seconde : À 6 h');
    expect(traits).toContain('Relief du sous-cadran : Plat');
  });

  it('montre la réserve de marche avec son échelle par défaut', () => {
    const config = defaultConfig();
    config.complications = [{ type: 'power-reserve', position: '9h' }];
    const traits = identitySections(visibleRows(catalog.rows, config), config)
      .find((s) => s.title === 'Complications')!
      .traits.map((t) => `${t.label} : ${t.value}`);
    expect(traits).toContain('Réserve de marche : À 9 h');
    expect(traits).toContain('Échelle de réserve : Heures (0 à 40 h)');
  });
});
