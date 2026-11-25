import { PAGE_ROWS, type NavCommand } from '../../core/nav/state';

/** Raccourcis clavier de la grille (spec §2.7). Renvoie null si la touche ne concerne pas la grille. */
export function commandFromKey(event: Pick<KeyboardEvent, 'key'>): NavCommand | null {
  switch (event.key) {
    case 'ArrowLeft':
      return { type: 'variant', delta: -1 };
    case 'ArrowRight':
      return { type: 'variant', delta: 1 };
    case 'ArrowUp':
      return { type: 'row', delta: -1 };
    case 'ArrowDown':
      return { type: 'row', delta: 1 };
    case 'Home':
      return { type: 'first-variant' };
    case 'End':
      return { type: 'last-variant' };
    case 'PageUp':
      return { type: 'row', delta: -PAGE_ROWS };
    case 'PageDown':
      return { type: 'row', delta: PAGE_ROWS };
    default:
      return null;
  }
}

/** Controls that give the arrows a meaning of their own (sliders, choice lists, text). */
const OWN_ARROWS =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="radio"], [role="tab"], [role="option"], [role="listbox"], [role="menuitem"], [role="spinbutton"]';

/**
 * In the preview, an arrow pressed beside the 3D view still browses the rows: on a plain
 * button of the settings panel, or with the focus lost (the panel it was in was replaced).
 */
export function browsesFrom(target: EventTarget | null, panel: string): boolean {
  const element = target as Element | null;
  if (!element?.closest || element === document.body) return true;
  return Boolean(element.closest(panel)) && !element.closest(OWN_ARROWS);
}

const SLIDERS = 'input[type="range"], [role="slider"]';

/**
 * Curseur saisi au pointeur dans le panneau de l'aperçu : une fois relâché, il rend les
 * flèches aux lignes (au clavier, atteint par Tab, il les garde pour se régler).
 */
export function pointerSlider(target: EventTarget | null, panel: string): Element | null {
  const element = target as Element | null;
  if (!element?.closest?.(panel)) return null;
  return element.closest(SLIDERS);
}
