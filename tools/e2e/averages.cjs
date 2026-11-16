// Average glucose by time of day in Overview (Guy, 16 Nov 2026), end to end against the test server
// (services/api: uvicorn tests.e2e_server:app). Synthetic readings for this check only.
// Usage: node tools/e2e/averages.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up avg@example.com.
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
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '80-140' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm', classic: true }, checkIns: { frequency: 'moreAtFirst' } };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  let page;
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'avg@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'avg@example.com', password: 'correct horse battery' } })).json.access_token;
    const docs = (await api('/consent', { token: tk })).json;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    // 20 days of 15-minute readings, higher in the afternoon and evening; nothing on days 9 and 10 back, so 30 days
    // shows 18 of 30.
    const start = Date.now() - 20 * 86400000; let items = []; let n = 0;
    for (let t = start; t < Date.now() - 600000; t += 15 * 60000) {
      const ago = Math.round((new Date().setUTCHours(0, 0, 0, 0) - new Date(t).setUTCHours(0, 0, 0, 0)) / 86400000);
      if (ago === 9 || ago === 10) continue;
      const h = new Date(t).getUTCHours();
      const v = 95 + 10 * Math.sin(((h - 9) / 24) * 2 * Math.PI) + (h >= 18 ? 15 : 0) + ((n * 7) % 11);
      items.push({ sample_id: `e2e-avg-${n++}`, measured_at: new Date(t).toISOString(), value: Math.round(v), unit: 'mg/dL', method: 'sensor' });
      if (items.length === 1000) { await api('/glucose/import', { method: 'POST', token: tk, body: { store: 'health_connect', items } }); items = []; }
    }
    if (items.length) await api('/glucose/import', { method: 'POST', token: tk, body: { store: 'health_connect', items } });
    const a7 = (await api('/metrics/averages?days=7', { token: tk })).json;
    ok('server 7 days', a7.days === 7 && a7.days_with_data === 7 && a7.slots.length === 8 && a7.slots.every((x) => x.mean != null), JSON.stringify({ d: a7.days_with_data, m: a7.mean }));
    const a30 = (await api('/metrics/averages?days=30', { token: tk })).json;
    ok('server 30 days counts days with readings', a30.days_with_data === 19, String(a30.days_with_data));

    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']])) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const T = he ? { title: 'ממוצע לפי שעות היום', d30: '30 ימים', mean: /^ממוצע: /, of30: 'יש קריאות ב־19 מתוך 30 ימים', of7: 'יש קריאות ב־7 מתוך 7 ימים' } : { title: 'Average by time of day', d30: '30 days', mean: /^Average: /, of30: 'Readings on 19 of 30 days', of7: 'Readings on 7 of 7 days' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('avg@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      await page.getByText(he ? 'סקירה' : 'Overview', { exact: true }).last().click(); await page.waitForTimeout(5000);
      const title = page.getByText(T.title, { exact: true }).first();
      await title.evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await page.mouse.wheel(0, -24); await page.waitForTimeout(600);
      ok(`${lang} ${scheme}: card shown`, await title.isVisible());
      ok(`${lang} ${scheme}: 7 of 7 days`, await page.getByText(T.of7, { exact: true }).first().isVisible());
      ok(`${lang} ${scheme}: overall average`, await page.getByText(T.mean).first().isVisible());
      await shot('01-7-days');
      await page.getByRole('radio', { name: T.d30 }).first().click(); await page.waitForTimeout(2500);
      ok(`${lang} ${scheme}: 30 days counts 19`, await page.getByText(T.of30, { exact: true }).first().isVisible());
      await shot('02-30-days');
      await ctx.close();
    }
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); if (page) await page.screenshot({ path: path.join(out, 'zz-fail.png') });
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
  process.exit(results.some((r) => !r.startsWith('PASS') && !r.startsWith('INFO')) ? 1 : 0);
});
