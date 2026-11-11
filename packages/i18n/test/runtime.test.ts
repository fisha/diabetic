import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTranslator, direction, isRTL, matchLocale, valueWithUnit, stripIsolates, isolateLtr, LOCALES, type Locale } from '../src/index.ts';

const load = (name: string) => JSON.parse(readFileSync(new URL(`../messages/${name}.json`, import.meta.url), 'utf8'));
const messages = Object.fromEntries(LOCALES.map((l) => [l, load(l)])) as Record<Locale, Record<string, string>>;

test('direction', () => {
  assert.equal(direction('he'), 'rtl');
  assert.equal(direction('ar'), 'rtl');
  assert.equal(direction('en'), 'ltr');
  assert.equal(direction('ru'), 'ltr');
  assert.ok(isRTL('he') && !isRTL('ru'));
});

test('matchLocale picks the first supported device language', () => {
  assert.equal(matchLocale(['fr-FR', 'he-IL', 'en-US']), 'he');
  assert.equal(matchLocale(['iw-IL']), 'he');
  assert.equal(matchLocale(['ar-EG']), 'ar');
  assert.equal(matchLocale(['ru_RU']), 'ru');
  assert.equal(matchLocale(['de', null, undefined]), 'en');
  assert.equal(matchLocale([]), 'en');
});

test('ICU plurals render per language', () => {
  const he = createTranslator({ locale: 'he', messages });
  const ar = createTranslator({ locale: 'ar', messages });
  const ru = createTranslator({ locale: 'ru', messages });
  const en = createTranslator({ locale: 'en', messages });
  assert.equal(en('ovr.reading.stale', { minutes: 1 }), 'No new readings for 1 minute');
  assert.equal(en('ovr.reading.stale', { minutes: 42 }), 'No new readings for 42 minutes');
  assert.equal(he('ovr.reading.stale', { minutes: 2 }), 'אין קריאות חדשות כבר 2 דקות');
  assert.equal(ar('ovr.reading.stale', { minutes: 2 }), 'لا توجد قراءات جديدة منذ دقيقتين');
  assert.equal(ru('ovr.reading.stale', { minutes: 5 }), 'Нет новых данных 5 минут');
  assert.equal(ru('ovr.reading.stale', { minutes: 3 }), 'Нет новых данных 3 минуты');
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
