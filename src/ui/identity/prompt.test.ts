import { describe, expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../../core/catalog/load';
import { defaultConfig } from '../../core/config/defaults';
import { localizeCatalog } from '../../core/i18n/catalog-en';
import { visibleRows } from '../../core/rules/visibility';
import { identitySections } from './identity';
import { generationPrompt } from './prompt';

const catalog = parseCatalog(rawCatalog);
const URL = 'https://epure.example/#v1.eyJhIjoyfQ';

describe('prompt de génération', () => {
  it('porte la consigne, le lien, toute la fiche puis les consignes de rendu', () => {
    const config = defaultConfig();
    const rows = visibleRows(catalog.rows, config);
    const prompt = generationPrompt(rows, config, URL);
    expect(prompt.startsWith('Génère une image photoréaliste')).toBe(true);
    const order = ['## Référence visuelle', URL, '## Fiche technique', '## Consignes de rendu'];
    const positions = order.map((part) => prompt.indexOf(part));
    expect(positions.every((at) => at >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    // Rien de la fiche d'identité ne se perd en route.
    for (const section of identitySections(rows, config)) {
      expect(prompt).toContain(`### ${section.title}`);
      for (const trait of section.traits)
        expect(prompt).toContain(`- ${trait.label} : ${trait.value}`);
    }
  });

  it('donne les teintes exactes en hexadécimal avec leur référence RAL', () => {
    const config = defaultConfig();
    const prompt = generationPrompt(visibleRows(catalog.rows, config), config, URL);
    expect(prompt).toContain('- Couleur du cadran : Noir (#111317, ≈ RAL 9005 Noir foncé)');
  });

  it('s’écrit en anglais pour un visiteur anglophone', () => {
    const config = defaultConfig();
    const rows = visibleRows(localizeCatalog(catalog, 'en').rows, config);
    const prompt = generationPrompt(rows, config, URL, 'en');
    expect(prompt.startsWith('Generate a photorealistic image')).toBe(true);
    expect(prompt).toContain('## Specification');
    expect(prompt).toContain('- Diameter: 40 mm');
  });
});
