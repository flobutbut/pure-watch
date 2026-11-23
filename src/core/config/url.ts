/** Versioned, self-contained watch links. No catalog indices or server storage. */
import { z } from 'zod';
import type { Catalog } from '../catalog/types';
import { defaultConfig } from './defaults';
import { getAtPath, isPlainObject, setAtPath } from './path';
import { blackTonneauPilot, cushionPilot } from './pilot';
import type { WatchConfig } from './types';
import frozenDefaults from './url-v1-defaults.json';

// Wire defaults and identifiers are immutable for v1. Changing application defaults
// or reordering the catalog must never reinterpret an already shared link.
// Older v1 links predate dial.shape. Their implicit shape remains round; the frozen
// JSON and all existing wire identifiers stay unchanged.
const V1_DEFAULTS = {
  ...frozenDefaults,
  case: { ...frozenDefaults.case, profile: 'curved' },
  bezel: { ...frozenDefaults.bezel, angleDeg: 0 },
  dial: { ...frozenDefaults.dial, shape: 'round', size: 'open' },
  hands: { ...frozenDefaults.hands, color: '#E8EBF0' },
  rehaut: { profile: 'classic', finish: 'dial', color: '#111317', scale: 'none' },
} as WatchConfig;
const MAX_HASH_LENGTH = 16_384;
const id = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const text = z.string().max(120);
const mm = z.number().finite().positive().max(200);
const boolean = z.boolean();

interface Field {
  path: string;
  schema: z.ZodType;
  ids?: Readonly<Record<string, number>>;
  bit?: boolean;
}
const field = (path: string, schema: z.ZodType = id, ids?: Field['ids']): Field => ({
  path,
  schema,
  ids,
});
const bit = (path: string): Field => ({ path, schema: boolean, bit: true });

// These numbers are assigned identifiers, NOT positions in the live catalog.
// Append new identifiers; never reuse or renumber an existing one.
const POSITIONS = { '12h': 1, '3h': 2, '4h30': 3, '6h': 4, '9h': 5, '2h': 6, '4h': 7 };
const FIELDS_V1: Readonly<Record<string, Field>> = {
  a: field('case.shape', id, {
    round: 1,
    cushion: 2,
    tonneau: 3,
    octagon: 4,
    square: 5,
    rectangle: 6,
    asymmetric: 7,
  }),
  b: field('case.diameterMm', z.number().finite().min(22).max(48)),
  c: field('case.thicknessMm', z.number().finite().min(3).max(25)),
  d: field('case.lugToLugMm', mm),
  e: field('case.lugWidthMm', mm),
  f: field('case.lugs', id, {
    straight: 1,
    curved: 2,
    pointed: 3,
    faceted: 4,
    teardrop: 5,
    drilled: 6,
    integrated: 7,
    none: 8,
  }),
  g: field('case.material', id, {
    steel: 1,
    titanium: 2,
    bronze: 3,
    'gold-yellow': 4,
    'gold-rose': 5,
    ceramic: 6,
    brass: 7,
    carbon: 8,
  }),
  h: field('case.finish', id, {
    mixed: 1,
    brushed: 2,
    polished: 3,
    sandblasted: 4,
    'pvd-black': 5,
    patina: 6,
  }),
  i: field('case.caseback', id, { solid: 1, display: 2, engraved: 3 }),
  j: field('crown.style', id, { fluted: 1, onion: 2, pointed: 3, square: 4, pump: 5, guarded: 6 }),
  k: field('crown.position', id, POSITIONS),
  l: bit('crown.guard'),
  m: bit('crown.screwed'),
  n: field('bezel.type', id, {
    smooth: 1,
    thin: 2,
    thick: 3,
    coin: 4,
    fluted: 5,
    notched: 6,
    rotating: 7,
    rounded: 8,
    stepped: 9,
  }),
  o: field('bezel.insert', id, {
    none: 1,
    aluminium: 2,
    ceramic: 3,
    sapphire: 4,
    'engraved-steel': 5,
  }),
  p: field('bezel.scale', id, {
    none: 1,
    'dive-60': 2,
    '12h': 3,
    '24h': 4,
    tachymeter: 5,
    pulsometer: 6,
    telemeter: 7,
  }),
  q: field('bezel.color', hex),
  r: field('bezel.pip', id, { none: 1, lume: 2, triangle: 3, hollow: 4 }),
  s: field('crystal.type', id, {
    'sapphire-flat': 1,
    'sapphire-domed': 2,
    'sapphire-box': 3,
    mineral: 4,
    acrylic: 5,
  }),
  t: field('crystal.coating', id, {
    none: 1,
    'ar-inner': 2,
    'ar-double': 3,
    'ar-blue': 4,
    'ar-violet': 5,
  }),
  u: bit('crystal.cyclops'),
  v: field('dial.material', id, {
    metal: 1,
    enamel: 2,
    'mother-of-pearl': 3,
    stone: 4,
    meteorite: 5,
    wood: 6,
    straw: 7,
  }),
  w: field('dial.finish', id, {
    matte: 1,
    sunburst: 2,
    grained: 3,
    guilloche: 4,
    enamel: 5,
    'iridescent-pearl': 6,
    'iridescent-oil': 7,
    lacquer: 8,
    fume: 9,
    'clous-de-paris': 10,
    linen: 11,
    concentric: 12,
    'vertical-brushed': 13,
    hammered: 14,
  }),
  x: field('dial.color', hex),
  y: field('dial.pattern', text.nullable()),
  z: field('dial.chapterRing', id, { none: 1, railroad: 2, dots: 3, ticks: 4, 'five-minute': 5 }),
  A: field('dial.indices.style', id, {
    baton: 1,
    'baton-facet': 2,
    dauphine: 3,
    dots: 4,
    triangles: 5,
    baguettes: 6,
    drops: 7,
    none: 8,
  }),
  B: field('dial.indices.finish'),
  C: field('dial.indices.lume', text.nullable()),
  D: field('dial.indices.numerals', id, {
    none: 1,
    all: 2,
    cardinal: 3,
    twelve: 4,
    'six-twelve': 5,
    explorer: 6,
    roman: 7,
  }),
  E: field('dial.indices.numeralFont', id, {
    sans: 1,
    'sans-bold': 2,
    geometric: 3,
    serif: 4,
    mono: 5,
    'art-nouveau': 6,
    'art-deco': 7,
    lapidary: 8,
    condensed: 9,
    futurist: 10,
    italic: 11,
  }),
  F: field('dial.text.brand', text),
  G: field('dial.text.line2', text),
  H: field('dial.text.position', id, POSITIONS),
  I: field('hands.set', id, {
    baton: 1,
    dauphine: 2,
    sword: 3,
    leaf: 4,
    breguet: 5,
    syringe: 6,
    spear: 7,
    pencil: 8,
    spade: 9,
    'art-deco': 10,
    skeleton: 11,
    cathedral: 12,
  }),
  J: field('hands.finish'),
  K: field('hands.lume', text.nullable()),
  L: field('hands.second.style', id, {
    thin: 1,
    counterweight: 2,
    lollipop: 3,
    arrow: 4,
    triangle: 5,
    baton: 6,
    diamond: 7,
    teardrop: 8,
    'ring-tail': 9,
    lightning: 10,
  }),
  M: field('hands.second.color', z.union([hex, z.literal('match')])),
  N: bit('hands.second.counterweight'),
  O: field(
    'complications',
    z.array(z.object({ type: id, position: id }).catchall(z.unknown())).max(8),
  ),
  P: field('strap.type'),
  Q: field('strap.material'),
  R: field('strap.color', hex),
  S: field('strap.stitching', hex.nullable()),
  T: field('strap.widthMm', mm),
  U: field('strap.buckle'),
  V: field('view.time', z.enum(['live', 'fixed']), { live: 1, fixed: 2 }),
  W: field('view.lighting', id, { studio: 1, day: 2, 'warm-interior': 3, night: 4 }),
  X: bit('view.night'),
  Y: field('style', id.nullable()),
  Z: field('movement'),
  aa: field('dial.shape', id, {
    round: 1,
    cushion: 2,
    tonneau: 3,
    octagon: 4,
    square: 5,
    rectangle: 6,
  }),
  ab: field('hands.color', hex),
  ac: field('rehaut.profile', id, { classic: 1, sloped: 2, concave: 3, stepped: 4 }),
  ad: field('rehaut.finish', id, { dial: 1, metal: 2, custom: 3 }),
  ae: field('rehaut.color', hex),
  af: field('rehaut.scale', id, { none: 1, minutes: 2, 'five-minute': 3, '24h': 4, tachymeter: 5 }),
  ag: field('dial.size', id, { compact: 1, balanced: 2, open: 3 }),
  ah: field('case.profile', id, { straight: 1, curved: 2, faceted: 3, stepped: 4 }),
  ai: field('bezel.angleDeg', z.number().finite().min(0).lt(360)),
};

function base64url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

/** Small default-free payload; colors, Unicode text and unexposed options are retained. */
export function encodeConfigHash(config: WatchConfig): string {
  const payload: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(FIELDS_V1)) {
    const value = getAtPath(config, descriptor.path);
    if (JSON.stringify(value) === JSON.stringify(getAtPath(V1_DEFAULTS, descriptor.path))) continue;
    payload[key] = descriptor.bit
      ? value
        ? 1
        : 0
      : typeof value === 'string' && descriptor.ids && Object.hasOwn(descriptor.ids, value)
        ? descriptor.ids[value]
        : value;
  }
  return `#v1.${base64url(JSON.stringify(payload))}`;
}

export interface ConfigLink {
  config: WatchConfig;
  notice: string;
}

const INVALID = 'Ce lien de configuration est invalide. La montre par défaut est affichée.';
const ADJUSTED =
  'Certaines options du lien ne sont pas reconnues ; leurs valeurs par défaut ont été utilisées.';

/** New catalog identifiers can travel literally until a later wire version assigns a token. */
function catalogContains(catalog: Catalog, path: string, value: string): boolean {
  return catalog.rows.some((row) =>
    row.variants.some((variant) => {
      if (row.path === path) return variant.value === value;
      return (
        path.startsWith(`${row.path}.`) &&
        getAtPath(variant.value, path.slice(row.path.length + 1)) === value
      );
    }),
  );
}

export function decodeConfigHash(hash: string, catalog: Catalog): ConfigLink {
  const fallback = (notice: string): ConfigLink => ({ config: defaultConfig(), notice });
  if (!hash || hash === '#') return fallback('');
  if (!hash.startsWith('#v1.'))
    return fallback(
      'Cette version de lien n’est pas prise en charge. La montre par défaut est affichée.',
    );
  if (hash.length > MAX_HASH_LENGTH || !/^#v1\.[A-Za-z0-9_-]+$/.test(hash))
    return fallback(INVALID);
  try {
    const encoded = hash.slice(4).replaceAll('-', '+').replaceAll('_', '/');
    const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    const payload: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!isPlainObject(payload)) return fallback(INVALID);
    let config = structuredClone(V1_DEFAULTS);
    let adjusted = false;
    const fields = new Map(Object.entries(FIELDS_V1));
    for (const [key, raw] of Object.entries(payload)) {
      const descriptor = fields.get(key);
      if (!descriptor) {
        adjusted = true;
        continue;
      }
      let value = raw;
      if (descriptor.bit && (raw === 0 || raw === 1)) value = raw === 1;
      if (descriptor.ids) {
        if (typeof raw === 'number')
          value = Object.keys(descriptor.ids).find((name) => descriptor.ids![name] === raw);
        if (
          typeof value === 'string' &&
          !Object.hasOwn(descriptor.ids, value) &&
          !catalogContains(catalog, descriptor.path, value)
        ) {
          adjusted = true;
          continue;
        }
      }
      const checked = descriptor.schema.safeParse(value);
      if (!checked.success) {
        adjusted = true;
        continue;
      }
      config = setAtPath(config, descriptor.path, checked.data);
    }
    return { config, notice: adjusted ? ADJUSTED : '' };
  } catch {
    return fallback(INVALID);
  }
}

/** Existing prototype URLs remain readable; an explicit hash always takes priority. */
export function readConfigUrl(url: URL, catalog: Catalog): ConfigLink {
  if (url.hash && url.hash !== '#') return decodeConfigHash(url.hash, catalog);
  const pilot = url.searchParams.get('pilot');
  return {
    config:
      pilot === 'black'
        ? blackTonneauPilot()
        : pilot === 'cushion'
          ? cushionPilot()
          : defaultConfig(),
    notice: '',
  };
}

/** Preserve route and unrelated diagnostics; the pilot name no longer owns the configuration. */
export function configUrl(config: WatchConfig, source: URL): URL {
  const url = new URL(source.href);
  url.searchParams.delete('pilot');
  url.hash = encodeConfigHash(config);
  return url;
}
