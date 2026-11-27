/** The two proposed curvatures. Faceted/stepped remain readable in existing links. */
export const CASE_CURVATURES = ['straight', 'curved'] as const;
export const CASE_PROFILES = ['straight', 'curved', 'faceted', 'stepped'] as const;
export type CaseProfile = (typeof CASE_PROFILES)[number];
export function effectiveCaseProfile(profile: string): CaseProfile {
  return CASE_PROFILES.includes(profile as CaseProfile) ? (profile as CaseProfile) : 'curved';
}
