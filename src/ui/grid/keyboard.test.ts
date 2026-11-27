import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { browsesFrom, pointerControl } from './keyboard';

/** Élément minimal : `closest` répond selon les sélecteurs qu'il « contient ». */
const element = (inside: Record<string, unknown>) => ({
  closest: (selector: string) =>
    Object.entries(inside).find(([key]) => selector.includes(key))?.[1] ?? null,
});
const as = (value: unknown) => value as Element;

describe('commandes réglées au pointeur', () => {
  for (const panel of ['[data-preview-panel]', '[data-settings-sheet]']) {
    it(`rendent les flèches une fois relâchées dans ${panel}`, () => {
      for (const control of [
        'input[type="range"]',
        '[role="radio"]',
        '[role="tab"]',
        'input[type="checkbox"]',
        '[role="switch"]',
      ]) {
        const found = { control };
        expect(pointerControl(as(element({ [panel]: {}, [control]: found })), panel)).toBe(found);
      }
    });

    it(`laissent les champs de saisie et l’extérieur de ${panel} tranquilles`, () => {
      // One types in a text or number field: its arrows move the caret or the value.
      for (const field of ['input[type="text"]', 'input[type="number"]', 'textarea'])
        expect(pointerControl(as(element({ [panel]: {}, [field]: {} })), panel)).toBeNull();
      expect(pointerControl(as(element({ [panel]: {} })), panel)).toBeNull();
      expect(pointerControl(as(element({ '[role="radio"]': {} })), panel)).toBeNull();
      expect(pointerControl(null, panel)).toBeNull();
    });
  }
});

describe('flèches depuis un panneau de réglages', () => {
  const panel = '[data-settings-sheet]';
  // Tests run without a DOM: only `document.body` is compared.
  beforeAll(() => vi.stubGlobal('document', { body: {} }));
  afterAll(() => vi.unstubAllGlobals());

  it('parcourent les lignes depuis un bouton ou une case à cocher', () => {
    expect(browsesFrom(as(element({ [panel]: {} })), panel)).toBe(true);
    // A checkbox gives the arrows no meaning of its own.
    expect(browsesFrom(as(element({ [panel]: {}, 'input[type="checkbox"]': {} })), panel)).toBe(
      true,
    );
  });

  it('laissent leurs flèches aux curseurs, choix et champs atteints au clavier', () => {
    for (const own of ['[role="slider"]', '[role="radio"]', '[role="tab"]', 'textarea'])
      expect(browsesFrom(as(element({ [panel]: {}, [own]: {} })), panel)).toBe(false);
  });

  it('ne parcourent rien depuis un autre endroit de la page', () => {
    expect(browsesFrom(as(element({})), panel)).toBe(false);
  });
});
