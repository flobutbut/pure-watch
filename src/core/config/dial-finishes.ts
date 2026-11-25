/** Stable wire identifiers. Retired identifiers remain reserved for existing links. */
export const DIAL_FINISH_IDS = {
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
  leather: 15,
  'circular-brushed': 16,
  tapisserie: 17,
  waves: 18,
  scales: 19,
  topographic: 20,
  'guilloche-woven-3': 21,
  'guilloche-chevron': 22,
  'guilloche-spiral-diamonds': 23,
  'guilloche-honeycomb': 24,
  'guilloche-rice': 25,
  'guilloche-fans': 26,
  perlage: 27,
  azure: 28,
} as const;
export type DialFinish = Exclude<keyof typeof DIAL_FINISH_IDS, 'fume'>;
export function isDialFinish(value: unknown): value is DialFinish {
  return typeof value === 'string' && value !== 'fume' && Object.hasOwn(DIAL_FINISH_IDS, value);
}
