// Day by day (Guy, 18 Nov 2026, PM-255): carbs and protein per day over a week, a month or chosen dates, from the Carbs
// and Protein sheets of Overview > Food today. End-to-end against the test server (services/api: uvicorn tests.e2e_server:app).
// Usage: node tools/e2e/day-by-day.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up dd@example.com.
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


const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const md = (d, lang) => { const dd = String(d.getDate()).padStart(2, '0'); const mm = String(d.getMonth() + 1).padStart(2, '0'); return lang === 'en' ? `${mm}.${dd}` : `${dd}.${mm}`; };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'dd@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'dd@example.com', password: 'correct horse battery' } })).json.access_token;
    const docs = (await api('/consent', { token: tk })).json;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    const answers = { ...ANSWERS, ratios: { ...ANSWERS.ratios, target: '80-140' }, companion: { ...ANSWERS.companion, classic: true } };
    await api('/profile', { method: 'PUT', token: tk, body: { locale: 'en', answers } });
    await api('/settings', { method: 'PUT', token: tk, body: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }).catch(() => null);
    const at = (h, m = 0, dayOff = 0) => { const d = new Date(); d.setDate(d.getDate() - dayOff); d.setHours(h, m, 0, 0); return d; };
    // [days back, hour, name, carbs, protein]. Two meals 4+ hours apart and no pump entry: the day reads as fully logged.
    const meals = [
      [1, 8, 'Eggs', 22, 18], [1, 13, 'Rice', 48, 23], [1, 19, 'Lentil soup', 30, 7],
      [2, 9, 'Toast', 30, 6],
      [3, 8, 'Oats', 40, null], [3, 14, 'Chicken', 5, 31],
      [5, 8, 'Yogurt', 15, 10], [5, 19, 'Pasta', 70, 14],
      [6, 9, 'Bread', 35, 8], [6, 20, 'Fish', 10, 30],
      [9, 8, 'Pancakes', 55, 9], [9, 19, 'Salad', 12, 20],
      [11, 8, 'Granola', 45, 7], [11, 18, 'Steak', 0, 40],
    ];
    if (new Date().getHours() >= 1) meals.push([0, 0, 'Banana', 27, 1]);
    let i = 0;
    for (const [off, h, name, carbs, protein] of meals) {
      const items = [{ name, unit: 'g', qty: 100, carbs_g: carbs, ...(protein != null ? { protein_g: protein } : {}), prov: 'wt', weighed: true }];
      const r = await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `dd-meal-${i++}`, kind: 'meal', occurred_at: at(h, 30, off).toISOString(), entered_at: new Date().toISOString(), source: 'manual', data: { items, ate: 'all', carbs_total_g: carbs, any_unknown: false, ...(protein != null ? { protein_total_g: protein } : {}) } } });
      if (r.status >= 300) ok(`meal ${name} saved`, false, String(r.status));
    }
    // The API's own range answer.
    const r = await api(`/nutrition/summary?from=${iso(at(0, 0, 11))}&to=${iso(at(0, 0, 9))}`, { token: tk });
    ok('API range lists only its days', r.status === 200 && r.json.days.map((d) => d.carbs_g).join(',') === '45,67', JSON.stringify(r.json?.days?.map((d) => [d.day, d.carbs_g])));
    ok('API refuses a range over 92 days', (await api(`/nutrition/summary?from=${iso(at(0, 0, 92))}&to=${iso(at(0, 0, 0))}`, { token: tk })).status === 422);

    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark'], ['en', 'dark']])) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = (name, full = false) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`), fullPage: full });
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('dd@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await page.getByRole('tab', { name: he ? 'סקירה' : 'Overview' }).first().click().catch(async () => page.getByText(he ? 'סקירה' : 'Overview', { exact: true }).last().click());
      await page.waitForTimeout(4000);
      const later = page.getByText(he ? 'אחר כך' : 'Later', { exact: true }).last();
      if (await later.isVisible().catch(() => false)) { await later.click(); await page.waitForTimeout(1000); }
      const tile = page.getByRole('button', { name: new RegExp(`^${he ? 'פחמימות עד עכשיו' : 'Carbs so far'},`) }).first();
      await tile.scrollIntoViewIfNeeded().catch(() => null);
      await tile.evaluate((el) => el.click()); await page.waitForTimeout(2500);
      await shot('01-carbs-sheet');
      await page.getByTestId('day-by-day').first().evaluate((el) => el.click()); await page.waitForTimeout(3000);
      await shot('02-week');
      const text = async () => (await page.locator('body').innerText()).replace(/[⁦-⁩‎‏]/g, '');
      let b = await text();
      if (lang === 'en') {
        // Week: days 1, 3, 5 and 6 are over and fully logged; day 3 has a meal without protein.
        ok('week: full-day carbs average', /Carbs\s*69 g/.test(b), (b.match(/Carbs[^\n]*\n?[^\n]*/g) || []).slice(0, 2).join(' | '));
        ok('week: full-day protein average', /Protein\s*37 g/.test(b));
        ok('week: full days 4/7', /Full days\s*4\/7/.test(b));
        ok('week: yesterday row', b.includes(md(at(0, 0, 1), 'en')) && /3 meals/.test(b) && /100 g\s*48 g/.test(b));
        ok('week: ≥ protein on a day with a meal without it', /45 g\s*≥ 31 g/.test(b));
        ok('week: partly logged day', /1 meal · Partly logged/.test(b));
        ok('week: a day without meals', /Nothing logged/.test(b));
        ok('week: 7 rows', (b.match(/\b\d\d\.\d\d\b/g) || []).length === 7, String((b.match(/\b\d\d\.\d\d\b/g) || []).length));
      } else {
        ok(`${lang}: dd.mm dates`, b.includes(md(at(0, 0, 1), 'he')));
      }
      await page.getByRole('radio', { name: he ? 'חודש' : 'Month' }).first().click(); await page.waitForTimeout(2500);
      b = await text();
      ok(`${lang}: month has 30 days`, (b.match(/\b\d\d\.\d\d\b/g) || []).length === 30, String((b.match(/\b\d\d\.\d\d\b/g) || []).length));
      if (lang === 'en') ok('month: full days 6/30', /Full days\s*6\/30/.test(b));
      await shot('03-month');
      await page.getByRole('radio', { name: he ? 'תאריכים' : 'Dates' }).first().click(); await page.waitForTimeout(2500);
      // The web's own date inputs.
      await page.getByRole('button', { name: new RegExp(`^${he ? 'מתאריך' : 'From'},`) }).first().click();
      await page.locator(`input[type=date][aria-label="${he ? 'מתאריך' : 'From'}"]`).fill(iso(at(0, 0, 11)));
      await page.waitForTimeout(800);
      await page.getByRole('button', { name: new RegExp(`^${he ? 'עד תאריך' : 'To'},`) }).first().click();
      await page.locator(`input[type=date][aria-label="${he ? 'עד תאריך' : 'To'}"]`).fill(iso(at(0, 0, 8)));
      await page.waitForTimeout(2500);
      await shot('04-range');
      b = await text();
      ok(`${lang}: range lists 4 days`, (b.match(/\b\d\d\.\d\d\b/g) || []).length === 4 + 2, String((b.match(/\b\d\d\.\d\d\b/g) || []).length));
      if (lang === 'en') ok('range: full-day averages over its 2 full days', /Carbs\s*56 g/.test(b) && /Protein\s*38 g/.test(b) && /Full days\s*2\/4/.test(b));
      // Open a day.
      await page.getByRole('button', { name: new RegExp(md(at(0, 0, 9), lang)) }).first().evaluate((el) => el.click()); await page.waitForTimeout(2500);
      b = await text();
      ok(`${lang}: a row opens the day`, /Pancakes/.test(b) && /Salad/.test(b));
      await shot('05-day');
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
