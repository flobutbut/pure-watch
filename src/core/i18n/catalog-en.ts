/**
 * Noms anglais des lignes et variantes du catalogue, par identifiant. Le catalogue garde
 * ses noms français ; une variante absente d'ici (« 22 mm ») garde son nom d'origine.
 */
import type { Catalog } from '../catalog/types';
import type { Locale } from './locale';

interface RowNames {
  name: string;
  hint?: string;
  variants?: Record<string, string>;
}

const SHAPES = {
  round: 'Round',
  cushion: 'Cushion',
  tonneau: 'Tonneau',
  octagon: 'Octagonal',
  square: 'Square',
  rectangle: 'Rectangular',
};

const AT = {
  '3h': 'At 3 o’clock',
  '6h': 'At 6 o’clock',
  '9h': 'At 9 o’clock',
  '12h': 'At 12 o’clock',
};

export const DIAL_FINISH_NAMES = {
  matte: 'Matte',
  sunburst: 'Sunburst',
  grained: 'Grained',
  lacquer: 'Lacquered',
  'iridescent-pearl': 'Mother-of-pearl',
  'iridescent-oil': 'Oil slick',
  guilloche: 'Guilloché',
  'guilloche-woven-3': 'Guilloché · three-strand weave',
  'guilloche-chevron': 'Guilloché · chevron',
  'guilloche-spiral-diamonds': 'Guilloché · spiral diamonds',
  'guilloche-honeycomb': 'Guilloché · honeycomb',
  'guilloche-rice': 'Guilloché · rice grain',
  'guilloche-fans': 'Guilloché · fans',
  perlage: 'Perlage',
  'clous-de-paris': 'Clous de Paris',
  linen: 'Linen',
  concentric: 'Concentric',
  'vertical-brushed': 'Vertical brushed',
  hammered: 'Hammered',
  leather: 'Leather effect',
  'circular-brushed': 'Circular brushed',
  tapisserie: 'Tapisserie',
  waves: 'Waves',
  scales: 'Scales',
  topographic: 'Topographic',
};

export const CATALOG_EN: Record<string, RowNames> = {
  'case-shape': { name: 'Case shape', variants: SHAPES },
  'case-profile': {
    name: 'Case profile',
    hint: 'Side silhouette of the case band',
    variants: { straight: 'Straight', curved: 'Curved', faceted: 'Faceted', stepped: 'Stepped' },
  },
  'case-size': { name: 'Size', hint: 'Case diameter, excluding the crown' },
  lugs: {
    name: 'Lugs',
    variants: {
      straight: 'Straight',
      curved: 'Curved',
      pointed: 'Pointed',
      faceted: 'Chamfered',
      teardrop: 'Teardrop',
      drilled: 'Drilled',
      integrated: 'Integrated',
      none: 'None',
    },
  },
  'case-material': {
    name: 'Case material',
    variants: {
      steel: 'Steel',
      titanium: 'Titanium',
      bronze: 'Bronze',
      'gold-yellow': 'Yellow gold',
      'gold-rose': 'Rose gold',
      brass: 'Plated brass',
      ceramic: 'Black ceramic',
      carbon: 'Forged carbon',
    },
  },
  'case-finish': {
    name: 'Case finish',
    variants: {
      mixed: 'Mixed (brushed and polished)',
      brushed: 'Brushed',
      polished: 'Polished',
      sandblasted: 'Sandblasted',
      'pvd-black': 'Black (PVD)',
      patina: 'Patinated',
    },
  },
  crown: {
    name: 'Crown',
    variants: {
      fluted: 'Fluted',
      onion: 'Onion',
      pointed: 'Pointed',
      square: 'Square',
      pump: 'Pump',
      guarded: 'With crown guard',
    },
  },
  'crown-position': {
    name: 'Crown position',
    variants: { '3h': '3 o’clock', '4h': '4 o’clock', '2h': '2 o’clock' },
  },
  bezel: {
    name: 'Bezel',
    hint: 'Bezels with a graduated insert use a round opening',
    variants: {
      smooth: 'Smooth',
      rounded: 'Domed',
      stepped: 'Double step',
      fluted: 'Fluted',
      coin: 'Coin edge',
      notched: 'Notched',
      rotating: 'Rotating · round opening',
      'fixed-scale': 'Fixed scale · round opening',
    },
  },
  'bezel-scale': {
    name: 'Bezel scale',
    variants: { 'dive-60': 'Dive · 60 min', '12h': '12 hours', '24h': '24 hours' },
  },
  'fixed-bezel-scale': {
    name: 'Bezel scale',
    variants: {
      tachymeter: 'Tachymeter',
      'dive-60': '60 minutes',
      '12h': '12 hours',
      '24h': '24 hours',
    },
  },
  crystal: {
    name: 'Crystal',
    variants: {
      'sapphire-flat': 'Flat sapphire',
      'sapphire-domed': 'Domed sapphire',
      'sapphire-box': 'Box sapphire',
      acrylic: 'Acrylic (Hesalite)',
    },
  },
  rehaut: {
    name: 'Flange',
    variants: {
      classic: 'Thin',
      sloped: 'Bevelled',
      concave: 'Concave',
      stepped: 'Stepped',
      flat: 'Flat',
    },
  },
  'rehaut-scale': {
    name: 'Flange markings',
    variants: {
      none: 'No markings',
      minutes: 'Minutes',
      'five-minute': 'Numbered minutes',
      '24h': '24 hours',
      tachymeter: 'Tachymeter',
    },
  },
  'dial-shape': { name: 'Dial shape', variants: SHAPES },
  'dial-size': {
    name: 'Dial opening',
    variants: { compact: 'Compact', balanced: 'Balanced', open: 'Open' },
  },
  'dial-finish': { name: 'Dial finish', variants: DIAL_FINISH_NAMES },
  'dial-color': {
    name: 'Dial color',
    variants: {
      black: 'Black',
      white: 'White',
      silver: 'Silver',
      champagne: 'Champagne',
      salmon: 'Salmon',
      copper: 'Copper',
      burgundy: 'Burgundy',
      green: 'Green',
      sky: 'Sky blue',
      navy: 'Midnight blue',
      slate: 'Slate gray',
    },
  },
  'chapter-ring': {
    name: 'Minute track',
    variants: {
      none: 'None',
      railroad: 'Railroad',
      dots: 'Dots',
      ticks: 'Ticks',
      'five-minute': 'Five-minute marks',
    },
  },
  numerals: {
    name: 'Numerals',
    variants: { none: 'None', twelve: '12 only', 'six-twelve': '6 and 12', all: 'All' },
  },
  'numeral-font': {
    name: 'Numeral style',
    variants: {
      sans: 'Fine sans-serif',
      'sans-bold': 'Bold sans-serif',
      geometric: 'Geometric',
      serif: 'Classic serif',
      mono: 'Mono',
      'art-nouveau': 'Art Nouveau',
      'art-deco': 'Art Deco',
      lapidary: 'Lapidary',
      condensed: 'Condensed',
      futurist: 'Futurist',
      italic: 'Italic',
      black: 'Extra bold',
      slab: 'Heavy slab',
      'fat-face': 'Bold Didone',
      stencil: 'Stencil',
    },
  },
  indices: {
    name: 'Indices',
    variants: {
      baton: 'Batons',
      'baton-facet': 'Faceted batons',
      dauphine: 'Dauphine',
      dots: 'Dots',
      triangles: 'Triangles',
      baguettes: 'Baguettes',
      drops: 'Teardrops',
      dive: 'Dive',
      'mixed-batons': 'Batons and dots',
      none: 'None',
    },
  },
  hands: {
    name: 'Hands',
    variants: {
      baton: 'Baton',
      dauphine: 'Dauphine',
      sword: 'Sword',
      leaf: 'Leaf',
      breguet: 'Breguet',
      syringe: 'Syringe',
      spear: 'Spear',
      pencil: 'Pencil',
      spade: 'Spade',
      'art-deco': 'Art Deco',
      skeleton: 'Skeleton',
      cathedral: 'Cathedral',
    },
  },
  seconds: {
    name: 'Seconds hand',
    variants: {
      thin: 'Thin',
      counterweight: 'With counterweight',
      lollipop: 'Lollipop',
      arrow: 'Arrow',
      triangle: 'Triangle',
      baton: 'Baton',
      diamond: 'Diamond',
      teardrop: 'Teardrop',
      'ring-tail': 'Open counterweight',
      lightning: 'Lightning',
      none: 'No seconds hand',
    },
  },
  'seconds-color': {
    name: 'Seconds hand color',
    variants: {
      orange: 'Orange',
      red: 'Red',
      blue: 'Blue',
      yellow: 'Yellow',
      match: 'Matching the hands',
    },
  },
  date: {
    name: 'Date',
    variants: {
      none: 'No date',
      '3h': AT['3h'],
      '4h30': 'At 4:30',
      '6h': AT['6h'],
      '12h': AT['12h'],
    },
  },
  'date-window': { name: 'Date window', variants: { framed: 'Framed', plain: 'Plain' } },
  'date-disc': {
    name: 'Date disc',
    variants: { white: 'White', black: 'Black', dial: 'Matching the dial' },
  },
  'date-loupe': {
    name: 'Date magnifier',
    variants: { none: 'No magnifier', cyclops: 'Cyclops' },
  },
  'small-seconds': {
    name: 'Small seconds',
    variants: { none: 'Central seconds', ...AT },
  },
  'small-seconds-style': {
    name: 'Sub-dial',
    variants: { flat: 'Flat', azure: 'Azurage', sunken: 'Sunken', rail: 'Railroad' },
  },
  'power-reserve': {
    name: 'Power reserve',
    variants: { none: 'No indicator', ...AT },
  },
  'power-reserve-style': {
    name: 'Reserve scale',
    variants: {
      arc: 'Hours (0 to 40 h)',
      segments: 'Up / down segments',
      fuel: 'E – F gauge',
    },
  },
  chronograph: {
    name: 'Chronograph',
    variants: {
      none: 'No chronograph',
      bicompax: 'Bicompax · 3 and 9 o’clock',
      tricompax: 'Tricompax · 3, 6 and 9 o’clock',
      vertical: 'Vertical bicompax · 6 and 12 o’clock',
    },
  },
  'chronograph-counters': {
    name: 'Counters',
    variants: {
      match: 'Matching the dial',
      black: 'Black (panda)',
      light: 'Light (reverse panda)',
    },
  },
  'chronograph-pushers': { name: 'Pushers', variants: { round: 'Round', pump: 'Pump' } },
};

/** Nom anglais d'une variante, ou undefined s'il n'y en a pas (le nom d'origine vaut). */
export function variantNameEn(rowId: string, variantId: string): string | undefined {
  return CATALOG_EN[rowId]?.variants?.[variantId];
}

/** Le catalogue avec les noms de la langue demandée ; mêmes identifiants, mêmes valeurs. */
export function localizeCatalog(catalog: Catalog, locale: Locale): Catalog {
  if (locale === 'fr') return catalog;
  return {
    ...catalog,
    rows: catalog.rows.map((row) => {
      const names = CATALOG_EN[row.id];
      if (!names) return row;
      return {
        ...row,
        i18n: { name: names.name, ...(names.hint ? { hint: names.hint } : {}) },
        variants: row.variants.map((variant) => {
          const name = names.variants?.[variant.id];
          return name ? { ...variant, i18n: { name } } : variant;
        }),
      };
    }),
  };
}
