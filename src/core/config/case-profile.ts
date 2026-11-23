/** Side profiles; old links retain the original curved midcase. */
export const CASE_PROFILES = ['straight', 'curved', 'faceted', 'stepped'] as const;
export type CaseProfile = (typeof CASE_PROFILES)[number];
export function effectiveCaseProfile(profile: string): CaseProfile {
  return CASE_PROFILES.includes(profile as CaseProfile) ? (profile as CaseProfile) : 'curved';
}
