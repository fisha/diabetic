// Unicode directional isolates (UAX #9). An isolate keeps a run such as "124 mg/dL" or "07:30" in its own
// direction inside Hebrew or Arabic text, so digits, units and times are not reordered around it.
const LRI = '⁦';
const RLI = '⁧';
const FSI = '⁨';
const PDI = '⁩';

/** Left-to-right isolate: numbers with units, times, emails, codes. */
export const isolateLtr = (text: string): string => `${LRI}${text}${PDI}`;
/** Right-to-left isolate. */
export const isolateRtl = (text: string): string => `${RLI}${text}${PDI}`;
/** First-strong isolate: user-entered text whose direction is unknown (names, notes). */
export const isolateAuto = (text: string): string => `${FSI}${text}${PDI}`;

/** Removes isolate controls, for comparisons and for accessibility labels where they are not needed. */
export const stripIsolates = (text: string): string => text.replace(/[⁦-⁩]/g, '');

/** A value with its unit, kept together left to right: "124 mg/dL", "6.9 mmol/L", "4 units". */
export const valueWithUnit = (value: string, unit: string): string => isolateLtr(`${value} ${unit}`);

// Paragraph direction. A paragraph's base direction decides where its punctuation goes and how mixed Hebrew/English
// runs are ordered. Left to "first strong character", a Hebrew sentence that starts with "Stedio", "AI" or a number
// becomes a left-to-right paragraph (PM-159). Where a platform cannot be told the paragraph direction (Android text
// layout), a direction mark at the start of every paragraph sets it.
const LRM = '\u200E';
const RLM = '\u200F';

/** How a piece of text picks its paragraph direction: the app language's, its own first strong character, or LTR. */
export type TextDirection = 'ltr' | 'rtl' | 'auto';

/** The invisible mark that starts a paragraph in this direction. */
export const directionMark = (dir: 'ltr' | 'rtl'): string => (dir === 'rtl' ? RLM : LRM);

/** Puts a direction mark at the start of each paragraph of `text`. "auto" leaves the text as it is. */
export function markParagraphs(text: string, dir: TextDirection, atStart = true): string {
  if (dir === 'auto' || text === '') return text;
  const mark = directionMark(dir);
  const body = text.replace(/\n(?![\u200E\u200F])/g, `\n${mark}`);
  return atStart && !body.startsWith(mark) ? `${mark}${body}` : body;
}

/**
 * The parts of a text element (strings, numbers and nested elements) with a direction mark at the start of each
 * paragraph. Parts that are not text are left as they are; when the first one is not text, a mark is put before it.
 */
export function markTextParts<T>(parts: readonly T[], dir: 'ltr' | 'rtl'): (T | string)[] {
  if (!parts.some((p) => typeof p === 'string' || typeof p === 'number' || (typeof p === 'object' && p !== null))) {
    return [...parts];
  }
  const out = parts.map((p, i) => (typeof p === 'string' || typeof p === 'number' ? markParagraphs(String(p), dir, i === 0) : p));
  return typeof out[0] === 'string' ? out : [directionMark(dir), ...out];
}

/** Removes direction marks and isolates, for comparisons. */
export const stripBidiControls = (text: string): string => text.replace(/[\u200E\u200F\u2066-\u2069]/g, '');
