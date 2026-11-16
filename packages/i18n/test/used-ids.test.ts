import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, type Locale } from '../src/index.ts';

/**
 * Every literal message id the app and the website pass to `t(...)` must exist in all four catalogs. A missing id
 * renders as the raw id on screen (16 Nov 2026: the re-consent screen showed "lg.t", "lg.terms" and so on because
 * the update was published from a checkout whose catalogs did not have them yet). Running this before an `eas update`
 * stops that.
 */
const root = fileURLToPath(new URL('../../../', import.meta.url));
const load = (name: string) => JSON.parse(readFileSync(new URL(`../messages/${name}.json`, import.meta.url), 'utf8'));
const messages = Object.fromEntries(LOCALES.map((l) => [l, load(l)])) as Record<Locale, Record<string, string>>;

const sources = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name.startsWith('.')) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
};

test('every message id used in the app and the website exists in every language', () => {
  const files = ['apps/mobile/src', 'apps/web/src'].flatMap((d) => sources(join(root, d)));
  // A checkout without the submodules has nothing to check; the app and website builds need them anyway.
  if (files.length === 0) return;
  const used = new Map<string, string>();
  for (const file of files) {
    for (const m of readFileSync(file, 'utf8').matchAll(/\bt\(\s*['"]([a-z]\w*\.[\w.]+)['"]/g)) {
      if (!used.has(m[1]!)) used.set(m[1]!, file.slice(root.length));
    }
  }
  assert.ok(used.size > 0);
  const missing = [...used].flatMap(([id, file]) =>
    LOCALES.filter((l) => !(id in messages[l])).map((l) => `${l}:${id} (${file})`),
  );
  assert.deepEqual(missing, []);
});
