import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { LOCALES, type Locale } from '../src/locales.ts';

const load = (name: string) => JSON.parse(readFileSync(new URL(`../messages/${name}.json`, import.meta.url), 'utf8'));
const catalog = Object.fromEntries(LOCALES.map((l) => [l, load(l)])) as Record<Locale, Record<string, string>>;
const meta = load('meta') as Record<string, { board: string; review: string[]; note?: string }>;

test('every locale has exactly the same ids as English, and every id has metadata', () => {
  const ids = Object.keys(catalog.en).sort();
  assert.ok(ids.length > 300);
  for (const l of LOCALES) assert.deepEqual(Object.keys(catalog[l]).sort(), ids, `${l} ids differ`);
  assert.deepEqual(Object.keys(meta).sort(), ids);
});

test('no message is empty', () => {
  for (const l of LOCALES) for (const [id, v] of Object.entries(catalog[l])) assert.ok(v.trim().length > 0, `${l}:${id}`);
});

function argsOf(ast: MessageFormatElement[], out = new Set<string>()): Set<string> {
  for (const el of ast) {
    if (el.type === TYPE.argument || el.type === TYPE.number || el.type === TYPE.date || el.type === TYPE.time) out.add(el.value);
    if (el.type === TYPE.plural || el.type === TYPE.select) {
      out.add(el.value);
      for (const o of Object.values(el.options)) argsOf(o.value, out);
    }
    if (el.type === TYPE.tag) argsOf(el.children, out);
  }
  return out;
}

function pluralKeys(ast: MessageFormatElement[], out: string[] = []): string[] {
  for (const el of ast) {
    if (el.type === TYPE.plural) {
      out.push(...Object.keys(el.options).filter((k) => !k.startsWith('=')));
      for (const o of Object.values(el.options)) pluralKeys(o.value, out);
    }
    if (el.type === TYPE.select) for (const o of Object.values(el.options)) pluralKeys(o.value, out);
  }
  return out;
}

test('every message is valid ICU and uses the same arguments in every locale', () => {
  for (const id of Object.keys(catalog.en)) {
    const enArgs = argsOf(parse(catalog.en[id]!));
    for (const l of LOCALES) {
      const ast = parse(catalog[l][id]!);
      const args = argsOf(ast);
      // Hebrew may add a gender select for the companion persona (board 13 note on rtn.day).
      args.delete('gender');
      assert.deepEqual([...args].sort(), [...enArgs].sort(), `${l}:${id} arguments differ from English`);
    }
  }
});

test('plural forms use only the categories each language has (CLDR)', () => {
  for (const l of LOCALES) {
    const allowed = new Set(new Intl.PluralRules(l).resolvedOptions().pluralCategories);
    for (const [id, v] of Object.entries(catalog[l])) {
      for (const k of pluralKeys(parse(v))) assert.ok(allowed.has(k as Intl.LDMLPluralRule), `${l}:${id} uses "${k}"`);
    }
  }
});

test('design-only text is not in the catalog', () => {
  const banned = ['com.c_hello', 'com.c_reply', 'com.u_say', 'com.h1s', 'com.demo', 'onb.sys_t', 'com.src_sensor'];
  for (const id of banned) assert.equal(catalog.en[id], undefined, id);
  for (const [id, v] of Object.entries(catalog.en)) {
    assert.doesNotMatch(v, /\bDana\b|\bNoa\b/, `${id} contains a sample name`);
    assert.doesNotMatch(v, /\b(124|142)\b\s*mg\/dL/, `${id} contains a sample reading`);
  }
});

test('non-English text is tagged for translation review (G-08) and clinical copy for clinical review (G-05)', () => {
  for (const [id, m] of Object.entries(meta)) assert.ok(m.review.includes('translation'), id);
  for (const id of ['com.low.body', 'com.low.title', 'ovr.insight.disclaimer', 'sys.disclaimer', 'com.insulin.note']) {
    assert.ok(meta[id]?.review.includes('clinical'), id);
  }
});
