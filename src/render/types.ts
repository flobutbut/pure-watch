/**
 * Contrat de rendu partagé par le prototype SVG et le moteur 3D (plan d'action §4).
 *
 * La grille ne sait pas d'où viennent les images : elle demande « la variante X de la
 * ligne Y dans tel contexte » et reçoit une image. Remplacer le rendu SVG par le rendu 3D
 * ne doit demander aucune modification de la grille.
 */
import type { PreviewContext, RowId } from '../core/catalog/types';
import type { WatchConfig } from '../core/config/types';

export interface PartRequest {
  rowId: RowId;
  variantId: string;
  context: PreviewContext;
  /**
   * Configuration courante : certains aperçus en dépendent
   * (la ligne Couleur montre le cadran dans la finition choisie).
   */
  config: WatchConfig;
  /** Taille de la cellule en pixels CSS. */
  sizePx: number;
  /** Densité de l'écran (devicePixelRatio, plafonné). */
  pixelRatio: number;
  /** Ordre de fabrication : plus petit = plus urgent (distance au centre de la grille). */
  priority?: number;
}

/** Image d'une pièce : balisage SVG (prototype) ou instantané 3D. */
export type PartImage = { kind: 'svg'; markup: string } | { kind: 'bitmap'; bitmap: ImageBitmap };

/** Montre complète rendue en direct (montre centrale, puis vue plein écran). */
export interface LiveWatch {
  /** Résolue quand la montre est assemblée et affichée pour la première fois. */
  ready: Promise<void>;
  update(config: WatchConfig, transient?: boolean): void;
  /** « grid » : vue de face, immobile ; « inspect » : trois quarts, orbite au pointeur. */
  setMode(mode: 'grid' | 'inspect'): void;
  /** Vue inspectée : vue prédéfinie (0 = face, 1 = profil gauche, 2 = dessus, 3 = dos, 4 = trois quarts). */
  view(index: number): void;
  /** Vue inspectée : rotation d'un pas, en degrés. */
  rotate(dAzDeg: number, dElDeg: number): void;
  /** Pause / lecture des aiguilles ; renvoie vrai si en pause. */
  togglePause(): boolean;
  /** Enable direct dragging of the ring, leaving camera orbit available otherwise. */
  setBezelControl(enabled: boolean, onchange: (angle: number) => void): void;
  /**
   * Échelle CSS appliquée par la page à l'élément de la montre (réduite dans la grille) :
   * le rendu se fait à la taille réellement affichée, pour rester net.
   */
  setDisplayScale(scale: number): void;
  destroy(): void;
}

export interface PartRenderer {
  readonly kind: 'svg' | '3d';
  /**
   * Clé de cache de l'aperçu : elle change dès que l'image doit être régénérée,
   * et seulement dans ce cas.
   */
  cacheKey(request: PartRequest): string;
  /** Produit l'image d'une pièce seule (instantané de cellule). Annulable. */
  renderPart(request: PartRequest, signal?: AbortSignal): Promise<PartImage>;
  /** Monte la montre complète en direct dans un conteneur. */
  mountWatch(target: HTMLElement, config: WatchConfig): LiveWatch;
  /** Libère toutes les ressources (contexte WebGL, textures, caches). */
  dispose(): void;
}
