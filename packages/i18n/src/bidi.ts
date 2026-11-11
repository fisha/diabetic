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
