#!/usr/bin/env node
// Fails if runtime code imports the design export, test fixtures or preview-only modules.
// Rule source: docs/handoff (section 3, "no invented data") and docs/implementation-plan.md section 1.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const runtimeRoots = ['apps/mobile/src', 'apps/web/src', 'apps/web/app', 'packages'];
const skipDirs = new Set(['node_modules', '__tests__', '__fixtures__', 'dist', '.expo', '.next']);
const isTestFile = (p) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(p) || /\.preview\.[cm]?[jt]sx?$/.test(p);
const forbidden = [
  { re: /from\s+['"][^'"]*design\/claude-design[^'"]*['"]/, why: 'design export is reference only' },
  { re: /from\s+['"][^'"]*tests\/fixtures[^'"]*['"]/, why: 'fixtures are test-only' },
  { re: /from\s+['"][^'"]*\.preview['"]/, why: 'preview modules are not runtime' },
  { re: /require\(\s*['"][^'"]*(design\/claude-design|tests\/fixtures)[^'"]*['"]\s*\)/, why: 'reference/fixture require' },
];

// The component preview and its specimen values live in apps/mobile/src/dev. Only the development route
// (src/app/dev, itself gated by devToolsEnabled) may import them; "@/dev/enabled" is the gate and is allowed anywhere.
const devOnly = /from\s+['"]@\/dev\/(?!enabled['"])[^'"]*['"]/;
const devAllowed = (rel) => rel.startsWith('apps/mobile/src/dev/') || rel.startsWith('apps/mobile/src/app/dev/');

const problems = [];
function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (skipDirs.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (!/\.[cm]?[jt]sx?$/.test(name) || isTestFile(p)) continue;
    const src = readFileSync(p, 'utf8');
    const rel = relative(root, p);
    for (const f of forbidden) if (f.re.test(src)) problems.push(`${rel}: ${f.why}`);
    if (devOnly.test(src) && !devAllowed(rel)) problems.push(`${rel}: development preview code is not runtime`);
  }
}
for (const r of runtimeRoots) walk(join(root, r));
if (problems.length) {
  console.error('Runtime import guard failed:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('Runtime import guard: OK');
