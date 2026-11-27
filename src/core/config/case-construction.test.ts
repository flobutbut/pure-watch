import { expect, it } from 'vitest';
import raw from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { defaultConfig } from './defaults';
import { CASE_DRAWINGS, caseDrawing, caseConstruction, caseDraft } from './case-construction';
import { withCaseDraft } from './case-dimensions';
import { applyVariant } from '../nav/selection';
import { encodeLinkPayload } from './link-codec';
import { decodeConfigHash, encodeConfigHash } from './url';
import { blackTonneauPilot } from './pilot';
const catalog = parseCatalog(raw);

it('keeps size first and a single case row with attachment drawings in its panel', () => {
  expect(catalog.rows.slice(0, 2).map((r) => r.id)).toEqual(['case-size', 'case-shape']);
  expect(catalog.rows.some((r) => ['case-profile', 'lugs'].includes(r.id))).toBe(false);
  expect(CASE_DRAWINGS).toEqual(['straight', 'pointed', 'teardrop', 'integrated', 'none']);
});

it('preserves shared curvature, edges, drilling and the connection while changing a drawing preset', () => {
  const config = defaultConfig(),
    draft = caseDraft(config);
  Object.assign(draft.construction, {
    dome: 0.81,
    integration: 0.63,
    edge: 'chamfer',
    edgeSizeMm: 0.65,
    drilled: true,
    underside: 'flat',
    tipThicknessMm: 1.4,
    tipOffsetMm: -1,
    transition: 0.9,
  });
  const changed = withCaseDraft(config, draft);
  const next = withCaseDraft(changed, {
    ...caseDraft(changed),
    lugs: 'teardrop',
    construction: caseDrawing(caseConstruction(changed), changed.case.diameterMm, 'teardrop'),
  });
  const settings = caseConstruction(next);
  expect(settings).toMatchObject({
    dome: 0.81,
    integration: 0.63,
    edge: 'chamfer',
    edgeSizeMm: 0.65,
    drilled: true,
    underside: 'flat',
    tipThicknessMm: 1.4,
    tipOffsetMm: -1,
    transition: 0.9,
    swell: 0.6,
    sectionRound: 0.85,
  });
  expect(config.case.construction?.edge).toBe('rounded');
});

it('shares a custom case draft and commits strap width and crown guards together', () => {
  const config = defaultConfig(),
    draft = caseDraft(config);
  draft.lugWidthMm = 22;
  draft.crownGuard = true;
  Object.assign(draft.construction, {
    integration: 0.37,
    taper: 0.6,
    dome: 0.73,
    attachment: 'block',
  });
  const next = withCaseDraft(config, draft);
  expect(next.case.lugs).toBe('integrated');
  expect(next.strap.widthMm).toBe(22);
  expect(next.crown.guard).toBe(true);
  expect(decodeConfigHash(encodeConfigHash(next), catalog).config).toEqual(next);
});

it('reads an older coupled profile as an explicit plane and metric tip thickness', () => {
  const legacy: Record<string, unknown> = {
    ...defaultConfig().case.construction,
    drop: 1,
    pointThin: 1,
  };
  for (const key of ['underside', 'tipThicknessMm', 'tipOffsetMm', 'transition'])
    delete legacy[key];
  const decoded = decodeConfigHash(encodeLinkPayload({ bj: legacy }), catalog);
  expect(decoded.notice).toBe('');
  expect(decoded.config.case.construction).toMatchObject({
    underside: 'flat',
    tipThicknessMm: 1.32,
  });
  expect(decoded.config.case.construction).not.toHaveProperty('drop');
  expect(decoded.config.case.construction).not.toHaveProperty('pointThin');
});

it('keeps a resized profile canonical in the draft and shared link', () => {
  const config = defaultConfig(),
    draft = caseDraft(config);
  draft.shape = 'cushion';
  draft.construction.tipThicknessMm = 9;
  const custom = withCaseDraft(config, draft);
  expect(custom.case.shape).toBe('cushion');
  const row = catalog.rows.find((row) => row.id === 'case-size')!;
  const small = applyVariant(custom, row, 0);
  expect(small.case.construction!.tipThicknessMm).toBeLessThan(9);
  expect(decodeConfigHash(encodeConfigHash(small), catalog).config).toEqual(small);
});

it('keeps crown guards in the case panel and reads the former guarded crown style', () => {
  const crown = catalog.rows.find((row) => row.id === 'crown')!;
  expect(crown.variants.map((variant) => variant.value)).not.toContain('guarded');
  const decoded = decodeConfigHash(encodeLinkPayload({ j: 6 }), catalog);
  expect(decoded.notice).toBe('');
  expect(decoded.config.crown).toMatchObject({ style: 'fluted', guard: true });
  expect(caseDraft(decoded.config).crownGuard).toBe(true);
});

it('keeps the attachment type of links and pilots that only name the lugs', () => {
  // Links from before the case construction carry `case.lugs` alone.
  for (const [token, attachment] of [
    [7, 'block'],
    [8, 'none'],
    [5, 'lugs'],
  ] as const) {
    const decoded = decodeConfigHash(encodeLinkPayload({ f: token }), catalog);
    expect(decoded.notice).toBe('');
    expect(caseConstruction(decoded.config).attachment).toBe(attachment);
  }
  expect(caseConstruction(blackTonneauPilot()).attachment).toBe('none');
  // Choosing lugs again in the panel still restores them.
  const config = withCaseDraft(blackTonneauPilot(), {
    ...caseDraft(blackTonneauPilot()),
    lugs: 'straight',
    construction: caseDrawing(caseConstruction(blackTonneauPilot()), 40, 'straight'),
  });
  expect(config.case.lugs).toBe('straight');
  expect(caseConstruction(config).attachment).toBe('lugs');
});
