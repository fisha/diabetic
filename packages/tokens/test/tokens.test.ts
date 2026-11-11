import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { day, night, palettes, contrastRatio, fontWeightNative, type, size } from '../src/index.ts';

const source = JSON.parse(readFileSync(new URL('../../../design/claude-design/tokens.json', import.meta.url), 'utf8'));

test('day and night palettes have the same keys', () => {
  assert.deepEqual(Object.keys(day).sort(), Object.keys(night).sort());
  assert.equal(palettes.day, day);
  assert.equal(palettes.night, night);
});

test('every runtime colour matches the design export exactly', () => {
  assert.equal(day.surfaceBg, source.color.surface.bg.day);
  assert.equal(night.surfaceBg, source.color.surface.bg.night);
  assert.equal(day.accent, source.color.accent.accent.day);
  assert.equal(night.accent, source.color.accent.accent.night);
  assert.equal(night.surfaceGroup, source.color.surface.group.night);
  assert.equal(day.inrange, source.color.clinical.inrange.day);
});

test('glucose hues are the same in both themes (design handoff)', () => {
  for (const k of ['below', 'inrange', 'above'] as const) assert.equal(day[k], night[k]);
});

test('canvas annotation colours are not shipped', () => {
  for (const k of Object.keys(day)) assert.doesNotMatch(k, /demo|planned|translation/i);
});

test('type scale keeps the design sizes', () => {
  assert.deepEqual(type.body, { fontSize: 16, lineHeight: 24, fontWeight: 400 });
  assert.deepEqual(type.largeTitle, { fontSize: 34, lineHeight: 41, fontWeight: 700 });
  assert.equal(size.touchMin, 44);
});

test('native font weights round the 650 variable weight to semibold', () => {
  assert.equal(fontWeightNative(650), '600');
  assert.equal(fontWeightNative(700), '700');
  assert.equal(fontWeightNative(400), '400');
});

test('contrast ratio matches WCAG reference values', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF').toFixed(2), '21.00');
  assert.equal(contrastRatio('#FFFFFF', '#FFFFFF').toFixed(2), '1.00');
  assert.equal(contrastRatio('#767676', '#FFFFFF').toFixed(2), '4.54');
});
