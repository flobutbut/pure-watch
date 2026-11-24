/**
 * Ce qui referme un overlay (panneau, modale) : Échap partout, Espace hors des
 * éléments où elle a déjà un sens (saisir, presser un bouton, suivre un lien, cocher), et un
 * clic dans le vide autour du panneau.
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

/**
 * Beyond this distance between pressing and releasing, the pointer dragged something (the
 * watch, the bezel, a slider): the click that follows does not close the overlay.
 */
export const CLICK_SLOP = 6;

interface Point {
  clientX: number;
  clientY: number;
}
interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A modal dialog's backdrop is the dialog itself: only the point tells them apart. */
export function outsideBox(point: Point, box: Box): boolean {
  return (
    point.clientX < box.left ||
    point.clientX > box.right ||
    point.clientY < box.top ||
    point.clientY > box.bottom
  );
}

/** A press and release close enough together to be a click on the void, not a drag. */
export function isTap(down: Point, up: Point): boolean {
  return Math.hypot(up.clientX - down.clientX, up.clientY - down.clientY) <= CLICK_SLOP;
}

/** Controls keep their own meaning beside a companion panel: clicking one is not the void. */
const CONTROLS = `${SPACE_OWNERS}, label, [role="gridcell"]`;

/**
 * The void around a panel: anything but a control, or a backdrop drawn to be clicked away
 * (`data-backdrop`, the veil of the 3D view).
 */
export function inVoid(target: EventTarget | null): boolean {
  const element = target as { closest?: (selector: string) => unknown } | null;
  if (!element?.closest) return true;
  return Boolean(element.closest('[data-backdrop]')) || !element.closest(CONTROLS);
}

/** Open overlays, the last one on top: only that one answers a click outside or a key. */
const stack: object[] = [];

export function openOverlay(overlay: object): () => void {
  stack.push(overlay);
  return () => {
    const index = stack.lastIndexOf(overlay);
    if (index >= 0) stack.splice(index, 1);
  };
}

export function isTopOverlay(overlay: object): boolean {
  return stack.at(-1) === overlay;
}
