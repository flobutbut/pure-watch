/**
 * Langues du site. Le français est la langue d'origine ; l'anglais sert aussi aux
 * visiteurs dont le navigateur ne demande ni l'une ni l'autre.
 */
export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Clé du choix manuel (pied de page). Aussi lue par le script en ligne d'index.html. */
export const LOCALE_KEY = 'epure:locale:v1';

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

/** Première langue du navigateur que le site parle ; l'anglais à défaut. */
export function detectLocale(languages: readonly string[]): Locale {
  for (const tag of languages) {
    const base = tag.trim().toLowerCase().split(/[-_]/)[0];
    if (isLocale(base)) return base;
  }
  return 'en';
}

/** Conventions d'écriture des nombres (virgule décimale, espace des milliers…). */
export const NUMBER_LOCALE: Record<Locale, string> = { fr: 'fr-FR', en: 'en-US' };

export function formatNumber(value: number, locale: Locale, maximumFractionDigits = 2): string {
  return value.toLocaleString(NUMBER_LOCALE[locale], { maximumFractionDigits });
}

/** Position horaire d'un identifiant de catalogue : « 4h30 » → « 4 h 30 » ou « 4:30 ». */
export function hourLabel(position: string, locale: Locale): string {
  const match = /^(\d+)h(\d+)?$/.exec(position);
  if (!match) return position;
  const [, hour, minutes] = match;
  if (locale === 'en') return minutes ? `${hour}:${minutes}` : `${hour} o’clock`;
  return minutes ? `${hour} h ${minutes}` : `${hour} h`;
}
