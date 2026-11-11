import { IntlMessageFormat, type PrimitiveType } from 'intl-messageformat';
import { DEFAULT_LOCALE, type Locale } from './locales.ts';

export type Messages = Readonly<Record<string, string>>;
export type Values = Record<string, PrimitiveType>;
export type Translate = (id: string, values?: Values) => string;

export type TranslatorOptions = {
  locale: Locale;
  messages: Readonly<Record<Locale, Messages>>;
  /** Called when an id is missing in the locale (falls back to English) or in every locale. */
  onMissing?: (id: string, locale: Locale) => void;
};

/**
 * Builds t(id, values) for one locale. Missing ids fall back to the English text and are reported through onMissing;
 * an id missing everywhere returns the id itself so the gap is visible, never invented text.
 */
export function createTranslator({ locale, messages, onMissing }: TranslatorOptions): Translate {
  const cache = new Map<string, IntlMessageFormat>();
  return (id, values) => {
    let source = messages[locale]?.[id];
    let sourceLocale: Locale = locale;
    if (source === undefined) {
      onMissing?.(id, locale);
      source = messages[DEFAULT_LOCALE]?.[id];
      sourceLocale = DEFAULT_LOCALE;
    }
    if (source === undefined) return id;
    const key = `${sourceLocale}\u0000${id}`;
    let fmt = cache.get(key);
    if (!fmt) {
      fmt = new IntlMessageFormat(source, sourceLocale);
      cache.set(key, fmt);
    }
    const out = fmt.format(values);
    return typeof out === 'string' ? out : String(out);
  };
}
