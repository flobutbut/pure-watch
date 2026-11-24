import { describe, expect, it } from 'vitest';
import { dismissKey, inVoid, isTap, isTopOverlay, openOverlay, outsideBox } from './dismiss';

/** A target that answers `closest` like an element of the given kind. */
const on = (owner: boolean) => ({ closest: () => (owner ? {} : null) });
const key = (k: string, extra: Partial<Parameters<typeof dismissKey>[0]> = {}) => ({
  key: k,
  target: on(false) as unknown as EventTarget,
  defaultPrevented: false,
  repeat: false,
  isComposing: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...extra,
});

describe('touches de fermeture des overlays', () => {
  it('Échap ferme, même depuis un champ', () => {
    expect(dismissKey(key('Escape'))).toBe(true);
    expect(dismissKey(key('Escape', { target: on(true) as unknown as EventTarget }))).toBe(true);
  });

  it('Espace ferme hors des champs, boutons et liens', () => {
    expect(dismissKey(key(' '))).toBe(true);
    expect(dismissKey(key(' ', { target: on(true) as unknown as EventTarget }))).toBe(false);
  });

  it('ignore une touche déjà traitée, maintenue, composée ou accompagnée d’un modificateur', () => {
    expect(dismissKey(key('Escape', { defaultPrevented: true }))).toBe(false);
    expect(dismissKey(key(' ', { repeat: true }))).toBe(false);
    expect(dismissKey(key(' ', { isComposing: true }))).toBe(false);
    expect(dismissKey(key(' ', { ctrlKey: true }))).toBe(false);
    expect(dismissKey(key('Enter'))).toBe(false);
  });
});

/** An element inside a control: it answers every selector but the backdrop marker. */
const insideControl = () =>
  ({
    closest: (selector: string) => (selector === '[data-backdrop]' ? null : {}),
  }) as unknown as EventTarget;

describe('clic dans le vide', () => {
  const box = { left: 100, top: 50, right: 440, bottom: 500 };
  const at = (clientX: number, clientY: number) => ({ clientX, clientY });

  it('situe le point hors du panneau, bords compris dedans', () => {
    expect(outsideBox(at(99, 200), box)).toBe(true);
    expect(outsideBox(at(200, 501), box)).toBe(true);
    expect(outsideBox(at(100, 50), box)).toBe(false);
    expect(outsideBox(at(300, 300), box)).toBe(false);
  });

  it('distingue un clic d’un glisser (tourner la montre)', () => {
    expect(isTap(at(10, 10), at(10, 10))).toBe(true);
    expect(isTap(at(10, 10), at(14, 13))).toBe(true);
    expect(isTap(at(10, 10), at(40, 10))).toBe(false);
  });

  it('le vide exclut les contrôles, sauf un voile prévu pour refermer', () => {
    const element = (matches: string[]) =>
      ({
        closest: (selector: string) => (matches.includes(selector) ? {} : null),
      }) as unknown as EventTarget;
    expect(inVoid(element([]))).toBe(true);
    expect(inVoid(null)).toBe(true);
    expect(inVoid(insideControl())).toBe(false);
    expect(inVoid(element(['[data-backdrop]']))).toBe(true);
  });

  it('seul l’overlay du dessus répond, et la main revient au précédent', () => {
    const below = {};
    const above = {};
    const closeBelow = openOverlay(below);
    expect(isTopOverlay(below)).toBe(true);
    const closeAbove = openOverlay(above);
    expect(isTopOverlay(below)).toBe(false);
    expect(isTopOverlay(above)).toBe(true);
    closeAbove();
    expect(isTopOverlay(below)).toBe(true);
    closeBelow();
    expect(isTopOverlay(below)).toBe(false);
  });
});
