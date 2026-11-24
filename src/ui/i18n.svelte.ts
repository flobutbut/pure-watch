/**
 * Langue de l'interface : celle du navigateur au premier passage, puis le choix fait dans
 * le pied de page, retenu d'une visite à l'autre. index.html applique la même règle avant
 * le JavaScript, pour la vue de chargement.
 */
import { detectLocale, isLocale, LOCALE_KEY, type Locale } from '../core/i18n/locale';
import { MESSAGES } from '../core/i18n/messages';

function storedLocale(): Locale | null {
  try {
    const value = localStorage.getItem(LOCALE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language ?? ''];
}

const initial: Locale = storedLocale() ?? detectLocale(browserLanguages());

export const i18n = $state<{ locale: Locale }>({ locale: initial });

if (typeof document !== 'undefined') document.documentElement.lang = initial;

/** Messages of the current language; reading it inside a template tracks the language. */
export function t() {
  return MESSAGES[i18n.locale];
}

export function setLocale(locale: Locale): void {
  if (locale === i18n.locale) return;
  i18n.locale = locale;
  document.documentElement.lang = locale;
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* Private browsing: the choice lasts for this visit. */
  }
}
