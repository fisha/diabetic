// Full days: protein per day and the day detail with carbs, protein and insulin (Guy, 17 Nov 2026), end-to-end check against the test server (services/api: uvicorn tests.e2e_server:app), which stands in for the model.
// Usage: node tools/e2e/breakdown.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up fd@example.com.
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

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'fd@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'fd@example.com', password: 'correct horse battery' } })).json.access_token;
    const docs = (await api('/consent', { token: tk })).json;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    await api('/profile', { method: 'PUT', token: tk, body: { locale: 'en', answers: { ...ANSWERS, ratios: { ...ANSWERS.ratios, target: '80-140' } } } });
    await api('/settings', { method: 'PUT', token: tk, body: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }).catch(() => null);
    const at = (h, m = 0, dayOff = 0) => { const d = new Date(); d.setDate(d.getDate() - dayOff); d.setHours(h, m, 0, 0); return d; };
    const hour = new Date().getHours();

    // Yesterday: three meals with protein, a pump bolus and an insulin you reported. Two days ago: one meal without protein.
    const meals = [[1, 8, 'Eggs', 22, 18], [1, 13, 'Rice', 48, 23], [1, 19, 'Lentil soup', 30, 7.4], [2, 9, 'Toast', 30, null], [2, 13, 'Chicken', 5, 31]];
    let i = 0;
    for (const [off, h, name, carbs, protein] of meals) {
      const items = [{ name, unit: 'g', qty: 100, carbs_g: carbs, ...(protein != null ? { protein_g: protein } : {}), prov: 'wt', weighed: true }];
      const r = await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `fd-meal-${i++}`, kind: 'meal', occurred_at: at(h, 5, off).toISOString(), entered_at: new Date().toISOString(), source: 'manual', data: { items, ate: 'all', carbs_total_g: carbs, any_unknown: false, ...(protein != null ? { protein_total_g: protein } : {}) } } });
      ok(`meal ${name} saved`, r.status === 200 || r.status === 201, String(r.status));
    }
    for (const [h, units, insulin] of [[8, 2.5, 'Fiasp'], [13, 4, 'Fiasp']]) {
      const r = await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `fd-ins-${i++}`, kind: 'insulin', occurred_at: at(h, 0, 1).toISOString(), entered_at: new Date().toISOString(), source: 'manual', data: { insulin, units, reason: 'meal' } } });
      ok(`insulin ${units} saved`, r.status === 200 || r.status === 201, String(r.status) + JSON.stringify(r.json).slice(0, 200));
    }
    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']])) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: { ...ANSWERS, ratios: { ...ANSWERS.ratios, target: '80-140' } } } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      page.setDefaultTimeout(6000);
      const L = lang === 'he' ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (lang === 'he') { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('fd@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await shot('00-after-sign-in');
      await page.getByRole('tab', { name: lang === 'he' ? 'סקירה' : 'Overview' }).first().click().catch(async () => page.getByText(lang === 'he' ? 'סקירה' : 'Overview', { exact: true }).last().click());
      await page.waitForTimeout(4000);
      // A character unlock for logging meals can open over Overview; set it aside.
      const later = page.getByText(lang === 'he' ? 'אחר כך' : 'Later', { exact: true }).last();
      if (await later.isVisible().catch(() => false)) { await later.click(); await page.waitForTimeout(1000); }
      const tile = page.getByRole('button', { name: new RegExp(`^${lang === 'he' ? 'ימים מלאים' : 'Full days'},`) }).first();
      await tile.scrollIntoViewIfNeeded().catch(() => null);
      await tile.evaluate((el) => el.click()); await page.waitForTimeout(2500);
      await shot('01-full-days');
      const body = (await page.locator('body').innerText()).replace(/[\u2066-\u2069]/g, '');
      if (lang === 'en') {
        ok('yesterday row shows protein', /3 meals · 100 g carbs · 48 g protein/.test(body), (body.match(/\d meals?[^\n]*/g) || []).join(' | '));
        ok('a day with a meal without protein reads ≥', /2 meals · 35 g carbs · ≥ 31 g protein/.test(body));
      }
      await page.getByRole('button', { name: new RegExp(lang === 'he' ? '^אתמול' : '^Yesterday') }).first().evaluate((el) => el.click()); await page.waitForTimeout(3000);
      await shot('02-day-detail');
      const d = (await page.locator('body').innerText()).replace(/[\u2066-\u2069]/g, '');
      if (lang === 'en') {
        ok('day detail: carbs', /Carbs\s*100 g/.test(d));
        ok('day detail: protein', /Protein\s*48 g/.test(d));
        ok('day detail: insulin total', /Insulin\s*6\.5 U · 2 entries/.test(d), d.slice(0, 400));
        ok('day detail: meals listed', /Lentil soup/.test(d) && /Fiasp · 2\.5 U/.test(d));
      }
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
