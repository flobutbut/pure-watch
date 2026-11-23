/**
 * Couleur réellement visible d'un cadran. Certaines matières ont leur propre teinte
 * (nacre, film d'huile) : la ligne Couleur ne s'y applique pas et disparaît de la grille.
 * La couleur choisie reste mémorisée pour le retour à une finition colorable.
 */
import type { DialConfig } from './types';

export const INTRINSIC_DIAL_COLORS: Readonly<Record<string, string>> = {
  'iridescent-pearl': '#E9E4DC',
  'iridescent-oil': '#2B2F3A',
};

export function hasIntrinsicColor(finish: string): boolean {
  return finish in INTRINSIC_DIAL_COLORS;
}

export function effectiveDialColor(dial: { finish: DialConfig['finish']; color: string }): string {
  return INTRINSIC_DIAL_COLORS[dial.finish] ?? dial.color;
}
