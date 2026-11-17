import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTranslator, direction, isRTL, matchLocale, savedLocale, valueWithUnit, stripIsolates, isolateLtr, LOCALES, type Locale } from '../src/index.ts';

const load = (name: string) => JSON.parse(readFileSync(new URL(`../messages/${name}.json`, import.meta.url), 'utf8'));
const messages = Object.fromEntries(LOCALES.map((l) => [l, load(l)])) as Record<Locale, Record<string, string>>;

test('direction', () => {
  assert.equal(direction('he'), 'rtl');
  assert.equal(direction('en'), 'ltr');
  assert.ok(isRTL('he') && !isRTL('en'));
});

test('matchLocale picks the first supported device language', () => {
  assert.equal(matchLocale(['fr-FR', 'he-IL', 'en-US']), 'he');
  assert.equal(matchLocale(['iw-IL']), 'he');
  // Arabic and Russian left the app (17 Nov 2026, PM-194): a phone in either language opens in English.
  assert.equal(matchLocale(['ar-EG']), 'en');
  assert.equal(matchLocale(['ru_RU', 'he-IL']), 'he');
  assert.deepEqual([...LOCALES], ['en', 'he']);
  assert.equal(matchLocale(['de', null, undefined]), 'en');
  assert.equal(matchLocale([]), 'en');
});

test('a saved Arabic or Russian choice reads as English (PM-194)', () => {
  assert.equal(savedLocale('he'), 'he');
  assert.equal(savedLocale('ar'), 'en');
  assert.equal(savedLocale('ru'), 'en');
  assert.equal(savedLocale('fr'), undefined);
  assert.equal(savedLocale(undefined), undefined);
});

test('ICU plurals render per language', () => {
  const he = createTranslator({ locale: 'he', messages });
  const en = createTranslator({ locale: 'en', messages });
  assert.equal(en('ovr.reading.stale', { minutes: 1 }), 'No new readings for 1 minute');
  assert.equal(en('ovr.reading.stale', { minutes: 42 }), 'No new readings for 42 minutes');
  assert.equal(he('ovr.reading.stale', { minutes: 2 }), 'אין קריאות חדשות כבר 2 דקות');
});

test('Hebrew companion persona gender select', () => {
  const he = createTranslator({ locale: 'he', messages });
  assert.match(he('rtn.day', { day: 2, total: 3, gender: 'f' }), /לומדת/);
  assert.match(he('rtn.day', { day: 2, total: 3, gender: 'm' }), /לומד /);
});

test('missing ids fall back to English and are reported; unknown ids return the id', () => {
  const missing: string[] = [];
  const partial = { ...messages, he: { ...messages.he } };
  delete partial.he['onb.cont'];
  const t = createTranslator({ locale: 'he', messages: partial, onMissing: (id, l) => missing.push(`${l}:${id}`) });
  assert.equal(t('onb.cont'), 'Continue');
  assert.equal(t('no.such.id'), 'no.such.id');
  assert.deepEqual(missing, ['he:onb.cont', 'he:no.such.id']);
});

test('values with units stay together left to right', () => {
  const v = valueWithUnit('124', 'mg/dL');
  assert.equal(v, '⁦124 mg/dL⁩');
  assert.equal(stripIsolates(v), '124 mg/dL');
  assert.equal(stripIsolates(isolateLtr('07:30')), '07:30');
});

test('a message missing one of its values returns its text instead of throwing (12 Nov 2026 launch crash)', () => {
  const t = createTranslator({ locale: 'en', messages });
  assert.equal(t('ins.f_workout_t', {}), messages.en['ins.f_workout_t']);
});
