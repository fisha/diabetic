// Clinic report (DAP-10, Guy 16 Nov 2026) end-to-end check against the test server (services/api: uvicorn tests.e2e_server:app).
// Usage: node tools/e2e/clinic-report.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up c@example.com. Sensor readings are not something the app can send, so the
// report is checked with the person's logged meals and insulin, and without sensor data ("No sensor readings").
const http = require('http'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Sol', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8091, async () => {
  const base = 'http://localhost:8091';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'c@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'c@example.com', password: 'correct horse battery' } })).json.access_token;
    for (let d = 0; d < 5; d++) {
      const at = new Date(Date.now() - d * 86400000 - 3600000).toISOString();
      const items = [{ name: 'Pita with hummus', unit: 'g', qty: 150, carbs_g: 45, prov: 'est' }];
      await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `cr-meal-${d}`, kind: 'meal', occurred_at: at, entered_at: at, source: 'manual', data: { items, ate: 'all', carbs_total_g: 45, any_unknown: false } } });
      await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `cr-ins-${d}`, kind: 'insulin', occurred_at: at, entered_at: at, source: 'manual', data: { insulin: 'Rapid', units: 4.5 } } });
    }
    for (const [lang, scheme] of [['en', 'light'], ['he', 'light'], ['he', 'dark']]) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2, acceptDownloads: true });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`), fullPage: true });
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const T = he ? { create: 'ליצור ולשתף', ready: 'הדוח מוכן', q: 'שאלות לביקור (לא חובה)', en: 'English' } : { create: 'Create and share', ready: 'Your report is ready', q: 'Questions for the visit (optional)', en: 'English' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('c@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await shot('00-after-sign-in');
      const tabP = he ? 'פרופיל' : 'Profile';
      await page.getByRole('tab', { name: tabP }).first().click().catch(async () => page.getByText(tabP, { exact: true }).last().click());
      await page.waitForTimeout(2500);
      await page.getByText(he ? 'פרטיות ונתונים' : 'Privacy and data', { exact: true }).first().click(); await page.waitForTimeout(2500);
      await shot('01-privacy-row');
      await page.getByText(he ? 'שיתוף עם הצוות המטפל' : 'Share with my care team', { exact: true }).first().click(); await page.waitForTimeout(2500);
      await shot('02-form');
      ok(`${lang} ${scheme}: form opens from Privacy`, (await page.getByText(T.create, { exact: true }).count()) > 0);
      await page.getByLabel(T.q, { exact: true }).fill(he ? 'האם לבדוק את הלילות?' : 'Can we look at the nights?');
      const download = page.waitForEvent('download', { timeout: 20000 });
      await page.getByText(T.create, { exact: true }).last().click();
      const dl = await download;
      const file = path.join(out, `${lang}-${scheme}-report.pdf`);
      await dl.saveAs(file);
      await page.waitForTimeout(1000);
      await shot('03-ready');
      ok(`${lang} ${scheme}: ready state shows`, (await page.getByText(T.ready, { exact: true }).count()) > 0);
      const text = execFileSync('pdftotext', ['-layout', file, '-']).toString();
      ok(`${lang} ${scheme}: PDF downloaded in the chosen language`, he ? text.includes('יום אחר יום') : text.includes('Day by day'), dl.suggestedFilename());
      ok(`${lang} ${scheme}: questions printed`, he ? text.includes('הלילות') : text.includes('Can we look at the nights?'));
      ok(`${lang} ${scheme}: carbs logged in the table`, /\b45\b/.test(text));
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
