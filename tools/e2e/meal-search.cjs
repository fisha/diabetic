// Search of past meals on Log a meal (PM-517, Itay via Guy 25 Nov 2026), end-to-end against the test server
// (services/api: uvicorn tests.e2e_server:app). Each run signs up its own person per language and theme, logs meals
// through the API (one 120 days ago, older than "Recent"), searches for it, and logs it again from the result.
// Usage: node tools/e2e/meal-search.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };
const TEXT = {
  en: { have: 'I already have an account', email: 'Email', pw: 'Password', go: 'Sign in', field: 'Search past meals', found: 'Past meals', recent: 'Recent meals', none: 'No past meal with', save: 'Save meal', clear: 'Clear search' },
  he: { have: 'כבר יש לי חשבון', email: 'אימייל', pw: 'סיסמה', go: 'כניסה', field: 'חיפוש בארוחות קודמות', found: 'ארוחות קודמות', recent: 'ארוחות אחרונות', none: 'אין ארוחה קודמת עם', save: 'שמירת הארוחה', clear: 'ניקוי החיפוש' },
};
const OLD = [{ name: 'שקשוקה', unit: 'g', qty: 250, carbs_g: 14, prov: 'man' }, { name: 'Sourdough toast', unit: 'piece', qty: 2, carbs_g: 30, prov: 'man' }];
const RECENT = (i) => [{ name: `Recent food ${i}`, unit: 'g', qty: 100, carbs_g: 20 + i, prov: 'man' }];

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  const has = async (page, text) => (await page.evaluate(() => document.body.innerText)).replace(/[⁦-⁩‎‏]/g, '').includes(text);
  try {
    for (const [lang, scheme, onlyOld] of [['en', 'light'], ['he', 'light'], ['he', 'dark'], ['en', 'light', true]]) {
      const T = TEXT[lang];
      const stamp = Date.now(); const email = `ms-${lang}-${scheme}-${stamp}@example.com`;
      await api('/auth/sign-up', { method: 'POST', body: { email, password: 'correct horse battery' } });
      const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: 'correct horse battery' } })).json.access_token;
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const old = new Date(Date.now() - 120 * 86400000);
      await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `ms-o-${lang}-${scheme}-${stamp}`, kind: 'meal', occurred_at: old.toISOString(), entered_at: old.toISOString(), source: 'manual', data: { items: OLD, ate: 'all', carbs_total_g: 44, any_unknown: false } } });
      for (let i = 0; i < (onlyOld ? 0 : 3); i++) {
        const at = new Date(Date.now() - (3 + i) * 86400000);
        await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `ms-r${i}-${lang}-${scheme}-${stamp}`, kind: 'meal', occurred_at: at.toISOString(), entered_at: at.toISOString(), source: 'manual', data: { items: RECENT(i), ate: 'all', carbs_total_g: 20 + i, any_unknown: false } } });
      }

      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const shot = (name, full = false) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`), fullPage: full });
      await page.goto(base); await page.getByText('I already have an account', { exact: true }).first().waitFor({ timeout: 20000 }); await page.waitForTimeout(500);
      if (lang === 'he') { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(T.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(T.email, { exact: true }).fill(email);
      await page.getByLabel(T.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(T.go, { exact: true }).last().click(); await page.waitForURL((u) => !/sign-in|welcome/.test(u.pathname), { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(3000);

      await page.goto(`${base}/meal`);
      if (!onlyOld) await page.getByText(T.recent, { exact: true }).first().waitFor({ timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const field = page.getByLabel(T.field, { exact: true }).first();
      if (onlyOld) {
        // Codex review on app#304: with no meal in the last 60 days, the field still shows and finds the old one.
        await field.waitFor({ timeout: 10000 }).catch(() => {});
        ok('only old meals: search field shows without Recent', (await field.isVisible()) && !(await has(page, T.recent)));
        await field.fill('toast'); await page.waitForTimeout(1800);
        ok('only old meals: finds the meal from 120 days ago', await has(page, 'שקשוקה, Sourdough toast'));
        await ctx.close();
        continue;
      }
      ok(`${lang} ${scheme}: Recent shows the last days, not the meal from 120 days ago`, (await has(page, 'Recent food 0')) && !(await has(page, 'שקשוקה')));
      ok(`${lang} ${scheme}: search field shows`, await field.isVisible());
      await field.scrollIntoViewIfNeeded(); await shot('01-start', true);
      await field.fill('שָׁקְשׁוּקָה');
      await page.getByText(T.found, { exact: true }).first().waitFor({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(1500);
      ok(`${lang} ${scheme}: finds the old meal (points ignored)`, (await has(page, T.found)) && (await has(page, 'שקשוקה, Sourdough toast')) && !(await has(page, 'Recent food 0')));
      await page.keyboard.press('Tab'); await page.waitForTimeout(300);
      await shot('02-found', true);
      await field.fill('sourdough');
      await page.waitForTimeout(1800);
      ok(`${lang} ${scheme}: English word in the same meal finds it`, await has(page, 'שקשוקה, Sourdough toast'));
      await field.fill('pizza'); await page.waitForTimeout(1800);
      ok(`${lang} ${scheme}: no match says so`, await has(page, T.none));
      await shot('03-none', true);
      await page.getByLabel(T.clear, { exact: true }).first().click(); await page.waitForTimeout(600);
      ok(`${lang} ${scheme}: clearing brings Recent back`, (await has(page, T.recent)) && (await has(page, 'Recent food 0')));
      await field.fill('toast'); await page.waitForTimeout(1800);
      await page.getByText('שקשוקה, Sourdough toast', { exact: true }).first().click(); await page.waitForTimeout(1500);
      ok(`${lang} ${scheme}: review opens with its foods`, (await has(page, 'שקשוקה')) && (await has(page, 'Sourdough toast')));
      await shot('04-review');
      await page.getByText(new RegExp('^' + T.save)).last().click(); await page.waitForTimeout(2500);
      const range = `since=${encodeURIComponent(new Date(Date.now() - 3600000).toISOString())}&until=${encodeURIComponent(new Date(Date.now() + 3600000).toISOString())}`;
      const meals = (await api(`/records?${range}&kind=meal`, { token: tk })).json;
      ok(`${lang} ${scheme}: stored once, now, with the same foods and carbs`, meals.length === 1 && meals[0].data.carbs_total_g === 44 && meals[0].data.items.length === 2, JSON.stringify(meals.map((m) => m.data.carbs_total_g)));
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  // A failed check fails the run (Codex review on #443).
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
  await browser.close(); server.close();
});
