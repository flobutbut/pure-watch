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

/**
 * Controls that give the arrows a meaning of their own (sliders, choice lists, text).
 * A checkbox has none: the arrows go on browsing the rows from it.
 */
const OWN_ARROWS =
  'input:not([type="checkbox"]), textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="radio"], [role="tab"], [role="option"], [role="listbox"], [role="menuitem"], [role="spinbutton"]';

/**
 * In the preview, an arrow pressed beside the 3D view still browses the rows: on a plain
 * button of the settings panel, or with the focus lost (the panel it was in was replaced).
 * The same holds in a settings sheet, which then closes and saves, as a click beside it does.
 */
export function browsesFrom(target: EventTarget | null, panel: string): boolean {
  const element = target as Element | null;
  if (!element?.closest || element === document.body) return true;
  return Boolean(element.closest(panel)) && !element.closest(OWN_ARROWS);
}

/**
 * Controls set with a click or a drag: sliders, segmented and choice lists, checkboxes.
 * Text and number fields are left out: one types in them, and their arrows move the caret.
 */
const POINTER_SET =
  'input[type="range"], [role="slider"], [role="radio"], [role="tab"], input[type="radio"], input[type="checkbox"], [role="checkbox"], [role="switch"]';

/**
 * Commande réglée au pointeur dans un panneau de réglages : une fois relâchée, elle rend
 * les flèches aux lignes (au clavier, atteinte par Tab, elle les garde pour se régler).
 */
export function pointerControl(target: EventTarget | null, panel: string): Element | null {
  const element = target as Element | null;
  if (!element?.closest?.(panel)) return null;
  return element.closest(POINTER_SET);
}
