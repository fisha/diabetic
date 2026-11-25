// "Log it again" on a meal's journal detail (PM-521, Guy 25 Nov 2026), end-to-end against the test server
// (services/api: uvicorn tests.e2e_server:app). Each run signs up its own person per language and theme, logs a meal
// for yesterday through the API, opens it in the Journal and logs it again from its detail.
// Usage: node tools/e2e/log-again.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
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
  en: { have: 'I already have an account', email: 'Email', pw: 'Password', go: 'Sign in', again: 'Log it again', save: 'Save meal' },
  he: { have: 'כבר יש לי חשבון', email: 'אימייל', pw: 'סיסמה', go: 'כניסה', again: 'לתעד שוב', save: 'שמירת הארוחה' },
};
const ITEMS = [{ name: 'Chicken shawarma', unit: 'g', qty: 150, carbs_g: 4, prov: 'man' }, { name: 'Rice pilaf', unit: 'g', qty: 180, carbs_g: 50, prov: 'man' }];

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
    for (const [lang, scheme] of [['en', 'light'], ['he', 'light'], ['he', 'dark']]) {
      const T = TEXT[lang];
      const stamp = Date.now(); const email = `la-${lang}-${scheme}-${stamp}@example.com`;
      await api('/auth/sign-up', { method: 'POST', body: { email, password: 'correct horse battery' } });
      const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: 'correct horse battery' } })).json.access_token;
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const y = new Date(Date.now() - 86400000); y.setHours(13, 0, 0, 0);
      await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `la-y-${lang}-${scheme}-${stamp}`, kind: 'meal', occurred_at: y.toISOString(), entered_at: y.toISOString(), source: 'manual', data: { items: ITEMS, ate: 'all', carbs_total_g: 54, any_unknown: false } } });

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

      // A legal update since sign-up (new privacy version) asks once.
      const agree = page.getByText(lang === 'he' ? 'אישור והמשך' : 'Agree and continue', { exact: true }).last();
      if (await agree.isVisible().catch(() => false)) { await agree.click(); await page.waitForTimeout(2000); }
      await page.goto(`${base}/journal`); await page.waitForTimeout(5000);
      if (await agree.isVisible().catch(() => false)) { await agree.click(); await page.waitForTimeout(2000); await page.goto(`${base}/journal`); await page.waitForTimeout(5000); }
      await page.getByText(/Chicken shawarma/).first().click(); await page.waitForTimeout(2500);
      const btn = page.getByText(T.again, { exact: true }).first();
      ok(`${lang} ${scheme}: meal detail shows Log it again`, await btn.isVisible().catch(() => false));
      await shot('01-detail', true);
      await btn.click(); await page.waitForTimeout(3000);
      ok(`${lang} ${scheme}: review opens with its foods`, (await has(page, 'Chicken shawarma')) && (await has(page, 'Rice pilaf')) && /\/meal\/review/.test(page.url()), page.url());
      await shot('02-review');
      await page.getByText(new RegExp('^' + T.save)).last().click(); await page.waitForTimeout(2500);
      const range = `since=${encodeURIComponent(new Date(Date.now() - 3600000).toISOString())}&until=${encodeURIComponent(new Date(Date.now() + 3600000).toISOString())}`;
      const meals = (await api(`/records?${range}&kind=meal`, { token: tk })).json;
      ok(`${lang} ${scheme}: stored once, now, with the same foods and carbs`, meals.length === 1 && meals[0].data.carbs_total_g === 54 && meals[0].data.items.length === 2, JSON.stringify(meals.map((m) => m.data.carbs_total_g)));
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
  await browser.close(); server.close();
});
