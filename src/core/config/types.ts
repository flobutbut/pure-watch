/**
 * Configuration d'une montre (spec §4.2). Toutes les longueurs sont en millimètres,
 * les identifiants en kebab-case, les couleurs libres en #RRGGBB.
 *
 * Les unions ci-dessous listent les valeurs connues ; elles restent ouvertes (`string`)
 * pour que le catalogue puisse en ajouter sans modifier le code (critère du jalon 1).
 */

import type { WatchDetails } from './details';
import type { CaseConstruction } from './case-construction';

type Open<T extends string> = T | (string & {});

export type HexColor = `#${string}`;
export type ClockPosition = Open<'12h' | '3h' | '4h30' | '6h' | '9h' | '2h' | '4h'>;

export interface CaseConfig {
  construction?: CaseConstruction;
  shape: Open<'round' | 'cushion' | 'tonneau' | 'octagon' | 'square' | 'rectangle' | 'asymmetric'>;
  /** Legacy side profile; the upper surface is driven by construction.dome. */
  profile: Open<'straight' | 'curved' | 'faceted' | 'stepped'>;
  /** Diamètre du boîtier hors couronne (décision D5). Le cadran en découle. */
  diameterMm: number;
  thicknessMm: number;
  lugToLugMm: number;
  lugWidthMm: number;
  /** Starting drawing identifier; independent controls live in construction. */
  lugs: Open<
    'straight' | 'curved' | 'pointed' | 'faceted' | 'teardrop' | 'drilled' | 'integrated' | 'none'
  >;
  /** Legacy link value; construction.integration drives the continuous connection. */
  lugJoin: 'detached' | 'flush' | 'blended';
  material: Open<
    'steel' | 'titanium' | 'bronze' | 'gold-yellow' | 'gold-rose' | 'ceramic' | 'brass' | 'carbon'
  >;
  finish: Open<'mixed' | 'brushed' | 'polished' | 'sandblasted' | 'pvd-black' | 'patina'>;
  caseback: Open<'solid' | 'display' | 'engraved'>;
}

export interface CrownConfig {
  style: Open<'fluted' | 'onion' | 'pointed' | 'square' | 'pump' | 'guarded'>;
  position: ClockPosition;
  guard: boolean;
  screwed: boolean;
}

export interface BezelConfig {
  shape: string;
  /** Width and height relative to the standard profile. */
  width: number;
  height: number;
  finish: string;
  /** Clockwise position of the bezel's zero marker, in degrees. */
  angleDeg: number;
  type: Open<
    | 'smooth'
    | 'thin'
    | 'thick'
    | 'coin'
    | 'fluted'
    | 'notched'
    | 'rotating'
    | 'rounded'
    | 'stepped'
    | 'fixed-scale'
  >;
  insert: Open<'none' | 'aluminium' | 'ceramic' | 'sapphire' | 'engraved-steel'>;
  scale: Open<'none' | 'dive-60' | '12h' | '24h' | 'tachymeter' | 'pulsometer' | 'telemeter'>;
  color: HexColor;
  pip: Open<'none' | 'lume' | 'triangle' | 'hollow'>;
}

export interface CrystalConfig {
  type: Open<'sapphire-flat' | 'sapphire-domed' | 'sapphire-box' | 'mineral' | 'acrylic'>;
  coating: Open<'none' | 'ar-inner' | 'ar-double' | 'ar-blue' | 'ar-violet'>;
  cyclops: boolean;
}

export interface RehautConfig {
  profile: Open<'classic' | 'sloped' | 'concave' | 'stepped' | 'flat'>;
  finish: Open<'dial' | 'metal' | 'custom'>;
  color: HexColor;
  scale: Open<'none' | 'minutes' | 'five-minute' | '24h' | 'tachymeter'>;
}

export interface DialConfig {
  size: Open<'compact' | 'balanced' | 'open'>;
  shape: Open<'round' | 'cushion' | 'tonneau' | 'octagon' | 'square' | 'rectangle'>;
  material: Open<'metal' | 'enamel' | 'mother-of-pearl' | 'stone' | 'meteorite' | 'wood' | 'straw'>;
  finish: Open<
    | 'matte'
    | 'sunburst'
    | 'grained'
    | 'guilloche'
    | 'guilloche-woven-3'
    | 'guilloche-chevron'
    | 'guilloche-spiral-diamonds'
    | 'guilloche-honeycomb'
    | 'guilloche-rice'
    | 'guilloche-fans'
    | 'perlage'
    | 'enamel'
    | 'iridescent-pearl'
    | 'iridescent-oil'
    | 'lacquer'
    | 'fume' // Read-only legacy value; normalized to sunburst plus the fumé effect.
    | 'clous-de-paris'
    | 'linen'
    | 'azure'
    | 'concentric'
    | 'vertical-brushed'
    | 'hammered'
    | 'leather'
    | 'circular-brushed'
    | 'tapisserie'
    | 'waves'
    | 'scales'
  >;
  color: HexColor;
  pattern: string | null;
  chapterRing: Open<'none' | 'railroad' | 'dots' | 'ticks' | 'five-minute'>;
  /** Encre automatique du cadran, sauf teinte choisie pour la piste des minutes. */
  chapterRingColor: HexColor | 'match';
  indices: {
    style: Open<
      | 'baton'
      | 'baton-facet'
      | 'dauphine'
      | 'dots'
      | 'triangles'
      | 'baguettes'
      | 'drops'
      | 'dive'
      | 'mixed-batons'
      | 'none'
    >;
    finish: string;
    lume: string | null;
    color: HexColor;
    lumeColor: HexColor;
    lumeEmission: HexColor;
    /** Jeu de chiffres : quelles heures portent un chiffre (les index y sont retirés). */
    numerals: Open<
      'none' | 'all' | 'cardinal' | 'twelve' | 'six-twelve' | 'explorer' | 'even' | 'roman'
    >;
    /** Independent of the hour positions. `numerals: roman` is a legacy alias only. */
    numeralSystem: 'arabic' | 'roman';
    /** Famille typographique des chiffres et textes imprimés. */
    numeralFont: Open<
      | 'sans'
      | 'sans-bold'
      | 'geometric'
      | 'serif'
      | 'mono'
      | 'art-nouveau'
      | 'art-deco'
      | 'lapidary'
      | 'condensed'
      | 'futurist'
      | 'italic'
      | 'black'
      | 'slab'
      | 'fat-face'
      | 'stencil'
    >;
    /** Facteur de taille des chiffres des heures (1 = taille de référence). */
    numeralSize: number;
    /** Facteur de longueur des index appliqués, dans l'axe du rayon (1 = référence). */
    indexLength: number;
    /** Facteur de largeur des index appliqués, en travers du rayon (1 = référence). */
    indexWidth: number;
    /** Distance des index au centre, en facteur de leur position habituelle. */
    indexRadius: number;
    /** Teinte des chiffres des heures, ou « match » : l'encre de l'impression. */
    numeralColor: HexColor | 'match';
    /**
     * Distance des chiffres au centre, en facteur du rayon de référence (1 = position
     * habituelle ; plus petit = plus près du centre).
     */
    numeralRadius: number;
  };
  text: { brand: string; line2: string; position: ClockPosition };
}

export interface HandAdjustment {
  style: string;
  length: number;
  width: number;
}
export interface HandsConfig {
  hour: HandAdjustment;
  minute: HandAdjustment;
  set: string;
  finish: string;
  /** Couleur conservée pour la finition laquée, indépendamment des métaux. */
  color: HexColor;
  lume: string | null;
  lumeColor: HexColor;
  lumeEmission: HexColor;
  second: {
    style: Open<
      | 'thin'
      | 'counterweight'
      | 'lollipop'
      | 'arrow'
      | 'triangle'
      | 'baton'
      | 'diamond'
      | 'teardrop'
      | 'ring-tail'
      | 'lightning'
      | 'none'
    >;
    /** Couleur laquée, ou « match » : même matière que les aiguilles. */
    color: HexColor | 'match';
    counterweight: boolean;
  };
}

export interface ComplicationConfig {
  type: string;
  position: ClockPosition;
  [option: string]: unknown;
}

export interface StrapConfig {
  type: string;
  material: string;
  color: HexColor;
  stitching: HexColor | null;
  widthMm: number;
  buckle: string;
  length?: 'short' | 'standard' | 'long';
  taperMm?: number;
  buckleFinish?: 'case' | 'steel' | 'gold-yellow' | 'gold-rose' | 'black';
}

export interface ViewConfig {
  time: 'live' | 'fixed';
  lighting: Open<'studio' | 'day' | 'warm-interior' | 'night'>;
  night: boolean;
}

export interface WatchConfig {
  details?: WatchDetails;
  schema: 1;
  style: string | null;
  movement: string;
  case: CaseConfig;
  crown: CrownConfig;
  bezel: BezelConfig;
  crystal: CrystalConfig;
  rehaut: RehautConfig;
  dial: DialConfig;
  hands: HandsConfig;
  complications: ComplicationConfig[];
  strap: StrapConfig;
  view: ViewConfig;
}
