import en from '../messages/en.json';
import he from '../messages/he.json';
import ar from '../messages/ar.json';
import ru from '../messages/ru.json';
import meta from '../messages/meta.json';
import type { Locale } from './locales.ts';
import type { Messages } from './translator.ts';

export type ReviewTag = 'translation' | 'clinical';
export type MessageMeta = { board: string; review: ReviewTag[]; note?: string };

/** The bundled catalog. Bundlers (Metro, Next.js) inline the JSON. */
export const messages: Readonly<Record<Locale, Messages>> = { en, he, ar, ru };
export const messageMeta: Readonly<Record<string, MessageMeta>> = meta as Record<string, MessageMeta>;

/**
 * Clinical copy (G-05) is shown only after clinical review. Until then the caller renders the approved
 * placeholder state instead of the text.
 */
export const needsClinicalReview = (id: string): boolean => messageMeta[id]?.review.includes('clinical') ?? false;
