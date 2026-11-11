import { day, night, type, space, radius, motion, size, breakpoint, elevation } from './generated/tokens.ts';

export { day, night, type, space, radius, motion, size, breakpoint, elevation };
export { contrastRatio, luminance } from './contrast.ts';

export type ColorToken = keyof typeof day;
export type Palette = { readonly [K in ColorToken]: string };
export type ThemeName = 'day' | 'night';
/** The user's appearance preference. "system" follows the OS setting (design handoff, G-13). */
export type AppearancePreference = 'system' | ThemeName;

export const palettes: Readonly<Record<ThemeName, Palette>> = { day, night };

export type TypeStyle = keyof typeof type;

/**
 * React Native accepts only the nine standard weights. The design uses 650 (a variable-font weight on the web);
 * native system fonts round it to semibold (600). Recorded as a native adaptation in docs/design-gaps.md.
 */
export function fontWeightNative(weight: number): '400' | '500' | '600' | '700' {
  if (weight >= 700) return '700';
  if (weight >= 600) return '600';
  if (weight >= 500) return '500';
  return '400';
}

/** Native shadow equivalents of the CSS elevation values (boxShadow is supported by RN 0.76+). */
export const elevationNative = {
  card: undefined,
  floating: '0px 10px 24px -8px rgba(0,0,0,0.35)',
  sheet: '0px -8px 40px 0px rgba(0,0,0,0.14)',
} as const;

export const scrim = elevation.scrim;
