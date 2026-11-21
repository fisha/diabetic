// The app's "Duet" design language (Jira PM-334, implemented in PM-335, Guy 20 Nov 2026).
// Source: the round 4 mockups' duet.css. Rounded white groups on a teal-tinted canvas, Rubik, one accent.
// Only the mobile app uses these values. The website and the clinic portal keep tokens.css (not part of Duet).
// Keys are the same as the generated palettes, so every screen keeps its colour roles.
import { day, night } from './generated/tokens.ts';

export const duetDay = {
  ...day,
  surfaceBg: '#F1F6F5', // canvas
  surfaceGroup: '#FFFFFF', // card / group
  surfaceGroupRaised: '#FFFFFF',
  surfaceFill: '#E0EAE9', // track
  surfaceHairline: '#E1EAE9',
  surfaceLine: '#C9D7D5',
  surfaceInverse: '#0F1F1E',
  ink: '#0F1F1E',
  ink2: '#2C3B3A',
  secondary: '#536462',
  tertiary: '#5E6F6D',
  accent: '#0B7A75',
  accentText: '#0A6560',
  accentPressed: '#085E5A',
  accentSoft: '#E4F2F1',
  accentSoft2: '#BFE3DF',
  nodata: '#E0EAE9',
  dangerBg: '#FBE9E4',
  dangerText: '#8A2A12',
} as const satisfies Record<keyof typeof day, string>;

export const duetNight = {
  ...night,
  surfaceBg: '#0B1312',
  surfaceGroup: '#16211F',
  surfaceGroupRaised: '#1F2C2A',
  surfaceFill: '#1F2C2A',
  surfaceHairline: '#243230',
  surfaceLine: '#34443F',
  surfaceInverse: '#2C3B3A',
  ink: '#EEF5F4',
  ink2: '#D3DEDD',
  secondary: '#9FB1AF',
  tertiary: '#8A9C9A',
  accent: '#14958D',
  accentText: '#6FD6CD',
  accentPressed: '#0E7C75',
  accentSoft: '#10302E',
  accentSoft2: '#1D5753',
  nodata: '#1F2C2A',
  dangerBg: '#3C1F18',
  dangerText: '#F1AE9C',
} as const satisfies Record<keyof typeof night, string>;

/**
 * Duet type scale: [fontSize, lineHeight, weight] for left-to-right text, and the Hebrew (right-to-left) size, which
 * is one step larger because Hebrew letters read smaller at the same size (duet.css: body 17/23, Hebrew 18/25).
 */
export const duetType = {
  largeTitle: { ltr: [32, 38], rtl: [32, 38], weight: 700 },
  title1: { ltr: [26, 32], rtl: [26, 32], weight: 700 },
  title2: { ltr: [22, 28], rtl: [22, 28], weight: 700 },
  headline: { ltr: [17, 23], rtl: [18, 25], weight: 600 },
  body: { ltr: [17, 23], rtl: [18, 25], weight: 400 },
  bodyStrong: { ltr: [17, 23], rtl: [18, 25], weight: 600 },
  callout: { ltr: [15, 21], rtl: [16, 23], weight: 500 },
  footnote: { ltr: [13, 18], rtl: [14, 20], weight: 400 },
  readingHero: { ltr: [56, 60], rtl: [56, 60], weight: 600 },
  readingUnit: { ltr: [17, 22], rtl: [17, 22], weight: 500 },
} as const;

/** Duet radii (duet.css): cards 24, groups 22, fields 18, chips and icon tiles. */
export const duetRadius = { card: 24, group: 22, field: 18, segment: 15, segmentOn: 12, iconTile: 12, sheet: 30 } as const;

/** Rubik font files by weight, as registered with expo-font (assets/fonts). */
export const RUBIK = {
  '400': 'Rubik-Regular',
  '500': 'Rubik-Medium',
  '600': 'Rubik-SemiBold',
  '700': 'Rubik-Bold',
} as const;
