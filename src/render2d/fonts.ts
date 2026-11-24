/**
 * Familles typographiques des chiffres et textes du cadran.
 *
 * Les familles « système » s'appuient sur les polices installées. Les familles de style
 * (Art nouveau, Art déco…) sont des polices libres (licence OFL, paquets @fontsource),
 * chargées seulement quand on les choisit, et embarquées dans le SVG d'impression sous
 * forme de données : une image SVG ne peut pas aller chercher de fichier externe.
 */

export interface FontDef {
  family: string;
  weight: number;
  style?: 'normal' | 'italic';
  /** Police à embarquer : renvoie le fichier woff2 en URL de données. */
  load?: () => Promise<string>;
  /** Nom de la famille déclarée dans le @font-face embarqué. */
  embedded?: string;
}

const inline = (module: Promise<{ default: string }>) => module.then((m) => m.default);

export const FONTS: Record<string, FontDef> = {
  sans: { family: 'Helvetica Neue, Helvetica, Arial, sans-serif', weight: 400 },
  'sans-bold': { family: 'Helvetica Neue, Helvetica, Arial, sans-serif', weight: 700 },
  geometric: { family: 'Futura, Avenir Next, Century Gothic, sans-serif', weight: 500 },
  serif: { family: 'Didot, Bodoni 72, Georgia, Times New Roman, serif', weight: 400 },
  mono: { family: 'SF Mono, Menlo, Consolas, monospace', weight: 500 },
  // Art nouveau : courbes végétales, empattements évasés (Federant).
  'art-nouveau': {
    family: 'Federant, serif',
    embedded: 'Federant',
    weight: 400,
    load: () => inline(import('@fontsource/federant/files/federant-latin-400-normal.woff2?inline')),
  },
  // Art déco : géométrie fine et haute (Poiret One).
  'art-deco': {
    family: 'Poiret One, sans-serif',
    embedded: 'Poiret One',
    weight: 400,
    load: () =>
      inline(import('@fontsource/poiret-one/files/poiret-one-latin-400-normal.woff2?inline')),
  },
  // Lapidaire : capitales gravées à la romaine, superbes en chiffres romains (Cinzel).
  lapidary: {
    family: 'Cinzel, serif',
    embedded: 'Cinzel',
    weight: 500,
    load: () => inline(import('@fontsource/cinzel/files/cinzel-latin-500-normal.woff2?inline')),
  },
  // Condensée : chiffres hauts et serrés, esprit montre de terrain (Bebas Neue).
  condensed: {
    family: 'Bebas Neue, sans-serif',
    embedded: 'Bebas Neue',
    weight: 400,
    load: () =>
      inline(import('@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2?inline')),
  },
  // Futuriste : formes carrées, sport et instruments (Orbitron).
  futurist: {
    family: 'Orbitron, sans-serif',
    embedded: 'Orbitron',
    weight: 500,
    load: () => inline(import('@fontsource/orbitron/files/orbitron-latin-500-normal.woff2?inline')),
  },
  // Italique : didone penchée, élégance habillée (Playfair Display).
  italic: {
    family: 'Playfair Display, serif',
    embedded: 'Playfair Display',
    weight: 400,
    style: 'italic',
    load: () =>
      inline(
        import('@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff2?inline'),
      ),
  },
  // Très grasse : grotesque noire, chiffres pleins et massifs (Archivo Black).
  black: {
    family: 'Archivo Black, sans-serif',
    embedded: 'Archivo Black',
    weight: 400,
    load: () =>
      inline(import('@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2?inline')),
  },
  // Slab épaisse : empattements carrés et lourds, esprit affiche (Alfa Slab One).
  slab: {
    family: 'Alfa Slab One, serif',
    embedded: 'Alfa Slab One',
    weight: 400,
    load: () =>
      inline(import('@fontsource/alfa-slab-one/files/alfa-slab-one-latin-400-normal.woff2?inline')),
  },
  // Didone grasse : contrastes extrêmes, pleins très noirs et déliés fins (Abril Fatface).
  'fat-face': {
    family: 'Abril Fatface, serif',
    embedded: 'Abril Fatface',
    weight: 400,
    load: () =>
      inline(import('@fontsource/abril-fatface/files/abril-fatface-latin-400-normal.woff2?inline')),
  },
  // Pochoir : chiffres coupés, montre militaire (Allerta Stencil).
  stencil: {
    family: 'Allerta Stencil, sans-serif',
    embedded: 'Allerta Stencil',
    weight: 400,
    load: () =>
      inline(
        import('@fontsource/allerta-stencil/files/allerta-stencil-latin-400-normal.woff2?inline'),
      ),
  },
};

export function fontDef(id: string | undefined): FontDef {
  return FONTS[id ?? 'sans'] ?? FONTS['sans']!;
}

const cache = new Map<string, Promise<string>>();

/** Règle @font-face à embarquer dans le SVG (chaîne vide pour une police système). */
export function fontFaceCss(id: string | undefined): Promise<string> {
  const font = fontDef(id);
  if (!font.load || !font.embedded) return Promise.resolve('');
  const key = id ?? 'sans';
  let css = cache.get(key);
  if (!css) {
    css = font
      .load()
      .then(
        (data) =>
          `@font-face{font-family:'${font.embedded}';src:url(${data}) format('woff2');` +
          `font-weight:${font.weight};font-style:${font.style ?? 'normal'};}`,
      );
    cache.set(key, css);
  }
  return css;
}
