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
