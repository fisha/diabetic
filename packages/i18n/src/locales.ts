export const LOCALES = ['en', 'he', 'ar', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Native names, as drawn on the language picker (ONB-01 / SET language). */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = { en: 'English', he: 'עברית', ar: 'العربية', ru: 'Русский' };

export type Direction = 'ltr' | 'rtl';
const RTL: ReadonlySet<Locale> = new Set<Locale>(['he', 'ar']);

export const isLocale = (v: unknown): v is Locale => typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
export const direction = (locale: Locale): Direction => (RTL.has(locale) ? 'rtl' : 'ltr');
export const isRTL = (locale: Locale): boolean => RTL.has(locale);

/**
 * Picks the first supported language from BCP 47 tags in preference order (for example the device's
 * preferred locales). "iw" is the legacy code for Hebrew. Falls back to English.
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
