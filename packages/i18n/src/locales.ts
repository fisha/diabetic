// Arabic and Russian left the app (Guy, 17 Nov 2026, PM-194); their catalogs are in git history before that change.
export const LOCALES = ['en', 'he'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Native names, as drawn on the language picker (ONB-01 / SET language). */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = { en: 'English', he: 'עברית' };

export type Direction = 'ltr' | 'rtl';
const RTL: ReadonlySet<Locale> = new Set<Locale>(['he']);

export const isLocale = (v: unknown): v is Locale => typeof v === 'string' && (LOCALES as readonly string[]).includes(v);

/** Languages the app had before (PM-194). A saved choice of one of them now reads as English. */
export const RETIRED_LOCALES: readonly string[] = ['ar', 'ru'];

/** A saved language as the app uses it now: a supported one as it is, a retired one as English, anything else unset. */
export const savedLocale = (v: unknown): Locale | undefined =>
  isLocale(v) ? v : typeof v === 'string' && RETIRED_LOCALES.includes(v) ? DEFAULT_LOCALE : undefined;
export const direction = (locale: Locale): Direction => (RTL.has(locale) ? 'rtl' : 'ltr');
export const isRTL = (locale: Locale): boolean => RTL.has(locale);

/**
 * Picks the first supported language from BCP 47 tags in preference order (for example the device's
 * preferred locales). "iw" is the legacy code for Hebrew. Falls back to English, also for a phone set to Arabic or Russian.
 */
export function matchLocale(tags: readonly (string | null | undefined)[]): Locale {
  for (const tag of tags) {
    if (!tag) continue;
    const lang = tag.toLowerCase().split(/[-_]/)[0];
    const normalized = lang === 'iw' ? 'he' : lang;
    if (isLocale(normalized)) return normalized;
  }
  return DEFAULT_LOCALE;
}
