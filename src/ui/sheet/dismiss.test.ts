import { describe, expect, it } from 'vitest';
import { dismissKey } from './dismiss';

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
