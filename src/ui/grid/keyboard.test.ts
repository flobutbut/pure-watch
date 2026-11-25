import { describe, expect, it } from 'vitest';
import { pointerSlider } from './keyboard';

/** Élément minimal : `closest` répond selon les sélecteurs qu'il « contient ». */
const element = (inside: Record<string, unknown>) => ({
  closest: (selector: string) =>
    Object.entries(inside).find(([key]) => selector.includes(key))?.[1] ?? null,
});

describe('curseurs de l’aperçu', () => {
  const panel = '[data-preview-panel]';

  it('rend les flèches après un curseur saisi au pointeur dans le panneau', () => {
    const range = { name: 'range' };
    const target = element({ [panel]: {}, 'input[type="range"]': range });
    expect(pointerSlider(target as unknown as Element, panel)).toBe(range);
  });

  it('laisse les autres commandes et l’extérieur du panneau tranquilles', () => {
    expect(pointerSlider(element({ [panel]: {} }) as unknown as Element, panel)).toBeNull();
    const outside = element({ 'input[type="range"]': {} });
    expect(pointerSlider(outside as unknown as Element, panel)).toBeNull();
    expect(pointerSlider(null, panel)).toBeNull();
  });
});
