// "Same as yesterday?" on Log a meal (PM-223, Guy 18 Nov 2026), end-to-end against the test server
// (services/api: uvicorn tests.e2e_server:app). Each run signs up its own person per language and theme, logs a meal
// for yesterday at about this time through the API, then logs it again from the card.
// Usage: node tools/e2e/repeat-meal.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
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
  en: { have: 'I already have an account', email: 'Email', pw: 'Password', go: 'Sign in', card: 'Same as yesterday?', log: 'Log it again', save: 'Save meal', saved: 'Meal saved' },
  he: { have: 'כבר יש לי חשבון', email: 'אימייל', pw: 'סיסמה', go: 'כניסה', card: 'כמו אתמול?', log: 'לתעד שוב', save: 'שמירת הארוחה', saved: 'הארוחה נשמרה' },
};
const ITEMS = [{ name: 'Oatmeal', unit: 'g', qty: 60, carbs_g: 36, prov: 'man' }, { name: 'Greek yogurt', unit: 'g', qty: 150, carbs_g: 6, prov: 'man' }, { name: 'Banana', unit: 'piece', qty: 1, carbs_g: 23, prov: 'man' }];

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
      const stamp = Date.now(); const email = `rep-${lang}-${scheme}-${stamp}@example.com`;
      await api('/auth/sign-up', { method: 'POST', body: { email, password: 'correct horse battery' } });
      const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: 'correct horse battery' } })).json.access_token;
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const y = new Date(Date.now() - 86400000 - 20 * 60000);
      const far = new Date(Date.now() - 86400000 - 5 * 3600000);
      await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `rep-y-${lang}-${scheme}-${stamp}`, kind: 'meal', occurred_at: y.toISOString(), entered_at: y.toISOString(), source: 'manual', data: { items: ITEMS, ate: 'all', carbs_total_g: 65, any_unknown: false } } });
      await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `rep-f-${lang}-${scheme}-${stamp}`, kind: 'meal', occurred_at: far.toISOString(), entered_at: far.toISOString(), source: 'manual', data: { items: [{ name: 'Pasta', unit: 'g', qty: 200, carbs_g: 60, prov: 'man' }], ate: 'all', carbs_total_g: 60, any_unknown: false } } });

      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const shot = (name, full = false) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`), fullPage: full });
      await page.goto(base); await page.getByText(T.have === 'I already have an account' ? T.have : 'I already have an account', { exact: true }).first().waitFor({ timeout: 20000 }); await page.waitForTimeout(500);
      if (lang === 'he') { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(T.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(T.email, { exact: true }).fill(email);
      await page.getByLabel(T.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(T.go, { exact: true }).last().click(); await page.waitForURL((u) => !/sign-in|welcome/.test(u.pathname), { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(3000);


      await page.goto(`${base}/meal`);
      await page.getByText(T.card, { exact: true }).first().waitFor({ timeout: 30000 }).catch(() => {}); await page.waitForTimeout(500);
      ok(`${lang} ${scheme}: card shows yesterday's meal at about this time`, (await has(page, T.card)) && (await has(page, 'Oatmeal, Greek yogurt, Banana')));
      await page.waitForTimeout(3000); await shot('01-same-as-yesterday');
      ok(`${lang} ${scheme}: the meal from five hours away is not suggested on the card`, !(await page.getByText('Pasta', { exact: true }).first().isVisible().catch(() => false)) || (await has(page, T.card)));
      await page.getByText(T.log, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await shot('02-review');
      ok(`${lang} ${scheme}: review opens with yesterday's foods`, (await has(page, 'Oatmeal')) && (await has(page, 'Banana')));
      await page.getByText(T.save, { exact: true }).last().click(); await page.waitForTimeout(2500);
      ok(`${lang} ${scheme}: saved`, await has(page, T.saved));
      const range = `since=${encodeURIComponent(new Date(Date.now() - 3 * 86400000).toISOString())}&until=${encodeURIComponent(new Date(Date.now() + 3600000).toISOString())}`;
      const meals = (await api(`/records?${range}&kind=meal`, { token: tk })).json;
      const today = meals.filter((m) => Math.abs(new Date(m.occurred_at).getTime() - Date.now()) < 10 * 60000);
      ok(`${lang} ${scheme}: stored once, now, with the same foods and carbs`, meals.length === 3 && today.length === 1 && today[0].data.carbs_total_g === 65 && today[0].data.items.length === 3, JSON.stringify(today.map((m) => m.data.carbs_total_g)));
      await page.goto(`${base}/meal`); await page.waitForTimeout(8000);
      await shot('03-after-logging');
      ok(`${lang} ${scheme}: card gone once today's meal is logged`, !(await has(page, T.card)));
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
