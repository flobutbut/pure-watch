import type { HexColor, WatchConfig } from './types';
import { deltaE2000, hexToLab } from '../color/delta-e';

export const DEFAULT_LUME = { lumeColor: '#E8EFD8', lumeEmission: '#78FFC1' } as const;

export interface LumeChoice {
  kind: string | null;
  day: HexColor;
  night: HexColor;
}

/** Screen approximations of documented pigment families, not colorimetric samples.
 * lookGain is artistic preview weighting, not a measured yield or an afterglow duration.
 * Sources and limitations: documentation/lume/README.md.
 */
export const LUME_PIGMENTS = [
  {
    id: 'c3',
    name: 'C3',
    day: '#E8EFD8',
    night: '#78FFC1',
    pair: 'c3Pair',
    performance: 'high',
    lookGain: 1,
  },
  {
    id: 'bgw9',
    name: 'BGW9',
    day: '#EDF1E9',
    night: '#65CAFF',
    pair: 'bgw9Pair',
    performance: 'high',
    lookGain: 0.92,
  },
  {
    id: 'c1',
    name: 'C1',
    day: '#F0F0E8',
    night: '#78FFC1',
    pair: 'c1Pair',
    performance: 'moderate',
    lookGain: 0.5,
  },
  {
    id: 'old-radium',
    name: 'Old Radium',
    day: '#DCC294',
    night: '#B5FF78',
    pair: 'oldRadiumPair',
    performance: 'variable',
    lookGain: 1,
  },
] as const;

export type LumePigment = (typeof LUME_PIGMENTS)[number];

export function lumePigment(kind: string | null | undefined): LumePigment | undefined {
  const key = kind?.toLowerCase().replace(/[\s-]/g, '');
  return LUME_PIGMENTS.find((pigment) => pigment.id.replace(/-/g, '') === key);
}

export function pigmentChoice(pigment: LumePigment): LumeChoice {
  return { kind: pigment.id, day: pigment.day, night: pigment.night };
}

const PIGMENT_LABS = LUME_PIGMENTS.map((pigment) => ({
  pigment,
  day: hexToLab(pigment.day)!,
  night: hexToLab(pigment.night)!,
}));

/** Legacy free colors migrate to a supported pair; nighttime reading gets more weight. */
export function closestLumePigment(choice: LumeChoice): LumePigment {
  const known = lumePigment(choice.kind);
  if (known) return known;
  const day = hexToLab(choice.day) ?? PIGMENT_LABS[0]!.day;
  const night = hexToLab(choice.night) ?? PIGMENT_LABS[0]!.night;
  let selected: LumePigment = LUME_PIGMENTS[0];
  let distance = Infinity;
  for (const entry of PIGMENT_LABS) {
    const next = deltaE2000(day, entry.day) + 2 * deltaE2000(night, entry.night);
    if (next < distance) {
      selected = entry.pigment;
      distance = next;
    }
  }
  return selected;
}

/** Off retains the paired swatches, so enabling restores a supported reference. */
export function enableLume(choice: LumeChoice): LumeChoice {
  return pigmentChoice(closestLumePigment(choice));
}

export function lumeChoice(part: {
  lume?: string | null;
  lumeColor: HexColor;
  lumeEmission: HexColor;
}): LumeChoice {
  const selected = pigmentChoice(
    closestLumePigment({ kind: part.lume ?? null, day: part.lumeColor, night: part.lumeEmission }),
  );
  return { ...selected, kind: part.lume ? selected.kind : null };
}

export function withLume(choice: LumeChoice | undefined) {
  if (!choice) return {};
  const selected = lumeChoice({
    lume: choice.kind,
    lumeColor: choice.day,
    lumeEmission: choice.night,
  });
  return { lume: selected.kind, lumeColor: selected.day, lumeEmission: selected.night };
}

/** URL boundaries also eliminate obsolete free values, including those memorized while off. */
export function normalizeLume(config: WatchConfig): WatchConfig {
  const normalize = <
    T extends { lume: string | null; lumeColor: HexColor; lumeEmission: HexColor },
  >(
    part: T,
  ): T => {
    const selected = withLume(lumeChoice(part));
    return part.lume === selected.lume &&
      part.lumeColor === selected.lumeColor &&
      part.lumeEmission === selected.lumeEmission
      ? part
      : { ...part, ...selected };
  };
  const hands = normalize(config.hands);
  const indices = normalize(config.dial.indices);
  return hands === config.hands && indices === config.dial.indices
    ? config
    : {
        ...config,
        hands,
        dial: indices === config.dial.indices ? config.dial : { ...config.dial, indices },
      };
}

/** Historical links may contain a named compound; every nonempty value enables an insert. */
export function hasLume(part: { lume: string | null }): boolean {
  return Boolean(part.lume);
}
