/**
 * Configuration d'une montre (spec §4.2). Toutes les longueurs sont en millimètres,
 * les identifiants en kebab-case, les couleurs libres en #RRGGBB.
 *
 * Les unions ci-dessous listent les valeurs connues ; elles restent ouvertes (`string`)
 * pour que le catalogue puisse en ajouter sans modifier le code (critère du jalon 1).
 */

type Open<T extends string> = T | (string & {});

export type HexColor = `#${string}`;
export type ClockPosition = Open<'12h' | '3h' | '4h30' | '6h' | '9h' | '2h' | '4h'>;

export interface CaseConfig {
  shape: Open<'round' | 'cushion' | 'tonneau' | 'octagon' | 'square' | 'rectangle' | 'asymmetric'>;
  profile: Open<'straight' | 'curved' | 'faceted' | 'stepped'>;
  /** Diamètre du boîtier hors couronne (décision D5). Le cadran en découle. */
  diameterMm: number;
  thicknessMm: number;
  lugToLugMm: number;
  lugWidthMm: number;
  lugs: Open<
    'straight' | 'curved' | 'pointed' | 'faceted' | 'teardrop' | 'drilled' | 'integrated' | 'none'
  >;
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
  type: Open<
    'smooth' | 'thin' | 'thick' | 'coin' | 'fluted' | 'notched' | 'rotating' | 'rounded' | 'stepped'
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
  profile: Open<'classic' | 'sloped' | 'concave' | 'stepped'>;
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
    | 'enamel'
    | 'iridescent-pearl'
    | 'iridescent-oil'
    | 'lacquer'
    | 'fume'
    | 'clous-de-paris'
    | 'linen'
    | 'concentric'
    | 'vertical-brushed'
    | 'hammered'
  >;
  color: HexColor;
  pattern: string | null;
  chapterRing: Open<'none' | 'railroad' | 'dots' | 'ticks' | 'five-minute'>;
  indices: {
    style: Open<
      'baton' | 'baton-facet' | 'dauphine' | 'dots' | 'triangles' | 'baguettes' | 'drops' | 'none'
    >;
    finish: string;
    lume: string | null;
    /** Jeu de chiffres : quelles heures portent un chiffre (les index y sont retirés). */
    numerals: Open<'none' | 'all' | 'cardinal' | 'twelve' | 'six-twelve' | 'explorer' | 'roman'>;
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
    >;
  };
  text: { brand: string; line2: string; position: ClockPosition };
}

export interface HandsConfig {
  set: string;
  finish: string;
  /** Couleur conservée pour la finition laquée, indépendamment des métaux. */
  color: HexColor;
  lume: string | null;
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
}

export interface ViewConfig {
  time: 'live' | 'fixed';
  lighting: Open<'studio' | 'day' | 'warm-interior' | 'night'>;
  night: boolean;
}

export interface WatchConfig {
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
