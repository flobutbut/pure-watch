/**
 * Touches qui referment un overlay (panneau, modale) : Échap partout, Espace hors des
 * éléments où elle a déjà un sens (saisir, presser un bouton, suivre un lien, cocher).
 */

/** Space types, presses or toggles here: it never closes the overlay from these. */
const SPACE_OWNERS =
  'input, textarea, select, button, a[href], summary, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="slider"], [role="option"], [role="menuitem"]';

interface KeyLike {
  key: string;
  target: EventTarget | null;
  defaultPrevented: boolean;
  repeat: boolean;
  isComposing: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export function dismissKey(event: KeyLike): boolean {
  if (event.defaultPrevented || event.isComposing) return false;
  if (event.altKey || event.ctrlKey || event.metaKey) return false;
  if (event.key === 'Escape') return true;
  // Holding Space must not close the next overlay too.
  if (event.key !== ' ' || event.repeat) return false;
  const target = event.target as { closest?: (selector: string) => unknown } | null;
  return !target?.closest?.(SPACE_OWNERS);
}
