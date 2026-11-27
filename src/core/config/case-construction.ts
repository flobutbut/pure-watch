import type { WatchConfig } from './types';

export const CASE_DRAWINGS = ['straight', 'pointed', 'teardrop', 'integrated', 'none'] as const;
export type CaseDrawing = (typeof CASE_DRAWINGS)[number];

export interface CaseConstruction {
  attachment: 'lugs' | 'block' | 'none';
  dome: number;
  /** 0 = recessed roots, 1 = filled roots. Shared by lugs and guards. */
  integration: number;
  transition: number;
  lugWidthMm: number;
  taper: number;
  /** Plan-view fullness: 0 = eased taper, 1 = holds its width and narrows into the tip. */
  swell: number;
  tipRound: number;
  /** Transverse section of the lug top: 0 = flat, 1 = domed (teardrop). */
  sectionRound: number;
  underside: 'flat' | 'curved';
  tipThicknessMm: number;
  /** Underside height at the tip, relative to the case-back plane. */
  tipOffsetMm: number;
  edge: 'sharp' | 'chamfer' | 'rounded';
  edgeSizeMm: number;
  drilled: boolean;
}

const bound = (v: number, lo = 0, hi = 1) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;

/** Starting drawings share one surface construction, rather than separate mesh types. */
export function casePreset(diameter: number, preset = 'straight'): CaseConstruction {
  const base: CaseConstruction = {
    attachment: 'lugs',
    dome: 0.35,
    integration: 0.45,
    transition: 0.6,
    lugWidthMm: bound(diameter * 0.065, 1.2, 5),
    taper: 0.15,
    swell: 0,
    tipRound: 0.35,
    sectionRound: 0,
    underside: 'flat',
    tipThicknessMm: bound(diameter * 0.065, 0.6, 6),
    tipOffsetMm: 0,
    edge: 'rounded',
    edgeSizeMm: 0.3,
    drilled: false,
  };
  switch (preset) {
    case 'curved':
      return {
        ...base,
        dome: 0.7,
        transition: 0.9,
        integration: 0.8,
        underside: 'curved',
        tipOffsetMm: -0.8,
      };
    case 'pointed':
      return {
        ...base,
        taper: 0.65,
        tipThicknessMm: bound(diameter * 0.035, 0.6, 6),
        tipRound: 0.1,
      };
    case 'teardrop':
      return {
        ...base,
        swell: 0.6,
        tipRound: 0.85,
        taper: 0.45,
        sectionRound: 0.85,
        integration: 0.8,
      };
    case 'faceted':
      return { ...base, edge: 'chamfer', edgeSizeMm: 0.6 };
    case 'drilled':
      return { ...base, drilled: true };
    case 'integrated':
      return { ...base, attachment: 'block', integration: 1 };
    case 'none':
      return { ...base, attachment: 'none' };
    default:
      return base;
  }
}

/** A plan-view drawing preserves the independent longitudinal profile and edges. */
export function caseDrawing(
  current: CaseConstruction,
  diameter: number,
  drawing: string,
): CaseConstruction {
  const preset = casePreset(diameter, drawing);
  const { attachment, lugWidthMm, taper, swell, tipRound, sectionRound } = preset;
  return { ...current, attachment, lugWidthMm, taper, swell, tipRound, sectionRound };
}

export function caseConstruction(config: WatchConfig): CaseConstruction {
  const base = casePreset(config.case.diameterMm, config.case.lugs);
  const input = config.case.construction as
    (Partial<CaseConstruction> & { pointThin?: number }) | undefined;
  // Explicitly pick the current controls: retired coupled drop/thinning values do
  // not linger in drafts or links. Older drawings keep their approximate tip thickness.
  const value = { ...base };
  for (const key of Object.keys(base) as (keyof CaseConstruction)[]) {
    if (input?.[key] !== undefined) Object.assign(value, { [key]: input[key] });
  }
  if (input?.tipThicknessMm === undefined && input?.pointThin !== undefined)
    value.tipThicknessMm = Number(
      (config.case.thicknessMm * (0.3 - bound(input.pointThin) * 0.18)).toFixed(3),
    );
  for (const key of [
    'dome',
    'integration',
    'transition',
    'taper',
    'swell',
    'tipRound',
    'sectionRound',
  ] as const)
    value[key] = bound(value[key]);
  value.lugWidthMm = bound(value.lugWidthMm, 1.2, 5);
  value.edgeSizeMm = bound(value.edgeSizeMm, 0.05, 1.2);
  value.tipThicknessMm = bound(
    value.tipThicknessMm,
    0.6,
    Math.min(25, config.case.thicknessMm * 0.85),
  );
  value.tipOffsetMm = bound(
    value.tipOffsetMm,
    -4,
    Math.max(0, config.case.thicknessMm * 0.85 - value.tipThicknessMm),
  );
  if (!['lugs', 'block', 'none'].includes(value.attachment)) value.attachment = 'lugs';
  // The default construction is a complete "classic lugs" drawing. Older links, pilots
  // and code that only set `case.lugs` to none or integrated keep that attachment type
  // instead of it. The settings panel always sets both consistently.
  if (config.case.lugs === 'none') value.attachment = 'none';
  else if (config.case.lugs === 'integrated') value.attachment = 'block';
  if (!['sharp', 'chamfer', 'rounded'].includes(value.edge)) value.edge = 'rounded';
  if (!['flat', 'curved'].includes(value.underside)) value.underside = 'flat';
  return value;
}

export function isCasePreset(config: WatchConfig): boolean {
  const actual = caseConstruction(config),
    preset = casePreset(config.case.diameterMm, config.case.lugs);
  return (
    ['attachment', 'lugWidthMm', 'taper', 'swell', 'tipRound', 'sectionRound'] as const
  ).every((key) =>
    typeof actual[key] === 'number'
      ? Math.abs((actual[key] as number) - (preset[key] as number)) < 0.001
      : actual[key] === preset[key],
  );
}

export type CaseDraft = Pick<
  WatchConfig['case'],
  'shape' | 'lugs' | 'diameterMm' | 'thicknessMm' | 'lugToLugMm' | 'lugWidthMm'
> & {
  construction: CaseConstruction;
  crownGuard: boolean;
};

export function caseDraft(config: WatchConfig): CaseDraft {
  const { shape, lugs, diameterMm, thicknessMm, lugToLugMm, lugWidthMm } = config.case;
  return {
    shape,
    lugs,
    diameterMm,
    thicknessMm,
    lugToLugMm,
    lugWidthMm,
    construction: caseConstruction(config),
    crownGuard: config.crown.guard || config.crown.style === 'guarded',
  };
}
