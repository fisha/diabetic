// Checks the text/background pairs the design uses against WCAG thresholds in both themes.
// Body text needs 4.5:1. Large text (>= 24 px, or >= 18.66 px bold) and graphical marks need 3:1.
// A failing pair fails the script unless it is listed in KNOWN with the design-gap id that tracks it.
import { palettes, contrastRatio, type ColorToken, type ThemeName } from '../src/index.ts';

type Pair = { fg: ColorToken; bg: ColorToken; min: 4.5 | 3; use: string };

const bodyOn = (fg: ColorToken, bgs: ColorToken[], use: string): Pair[] => bgs.map((bg) => ({ fg, bg, min: 4.5, use }));
const surfaces: ColorToken[] = ['surfaceBg', 'surfaceGroup', 'surfaceGroupRaised'];

export const PAIRS: Pair[] = [
  ...bodyOn('ink', surfaces, 'primary text'),
  ...bodyOn('ink2', surfaces, 'secondary emphasis text'),
  ...bodyOn('secondary', surfaces, 'secondary text'),
  ...surfaces.map((bg): Pair => ({ fg: 'tertiary', bg, min: 3, use: 'tertiary text (placeholders, large captions)' })),
  ...bodyOn('accentText', [...surfaces, 'accentSoft'], 'accent text, links'),
  { fg: 'onAccent', bg: 'accent', min: 4.5, use: 'primary button label' },
  { fg: 'onAccent', bg: 'accentPressed', min: 4.5, use: 'pressed primary button label' },
  { fg: 'dangerText', bg: 'dangerBg', min: 4.5, use: 'destructive button label' },
  { fg: 'belowText', bg: 'belowBg', min: 4.5, use: 'below-range badge' },
  { fg: 'inrangeText', bg: 'inrangeBg', min: 4.5, use: 'in-range badge' },
  { fg: 'aboveText', bg: 'aboveBg', min: 4.5, use: 'above-range badge' },
  ...(['below', 'inrange', 'above'] as const).map((fg): Pair => ({ fg, bg: 'surfaceBg', min: 3, use: 'glucose mark' })),
];

/** Known failures, each tracked by a design gap. Key: `${theme}:${fg}/${bg}`. */
export const KNOWN: Record<string, string> = {
  'day:tertiary/surfaceGroup': 'G-16',
  'day:below/surfaceBg': 'G-16',
  'day:inrange/surfaceBg': 'G-16',
  'day:above/surfaceBg': 'G-16',
  'night:onAccent/accent': 'G-16',
};

let failed = 0;
const report: string[] = [];
for (const theme of ['day', 'night'] as ThemeName[]) {
  for (const p of PAIRS) {
    const ratio = contrastRatio(palettes[theme][p.fg], palettes[theme][p.bg]);
    const key = `${theme}:${p.fg}/${p.bg}`;
    if (ratio + 1e-9 < p.min) {
      const gap = KNOWN[key];
      report.push(`${gap ? 'KNOWN' : 'FAIL '} ${key} ${ratio.toFixed(2)}:1 < ${p.min}:1 (${p.use})${gap ? ` [${gap}]` : ''}`);
      if (!gap) failed++;
    } else if (process.argv.includes('--verbose')) {
      report.push(`ok    ${key} ${ratio.toFixed(2)}:1 (${p.use})`);
    }
  }
}
console.log(report.join('\n') || 'all pairs pass');
console.log(`${PAIRS.length * 2} pairs checked, ${failed} unexpected failures`);
if (failed) process.exit(1);
