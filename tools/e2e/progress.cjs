// Progress against a baseline, the typical day and insight learning data, end to end against the test server
// (services/api: uvicorn tests.e2e_server:app). Synthetic readings for this check only.
// Usage: node tools/e2e/progress.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up g@example.com.
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
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '80-140' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); global.lastPage = page;
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`), fullPage: false });
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'g@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'g@example.com', password: 'correct horse battery' } })).json.access_token;
    await api('/profile', { method: 'PUT', token: tk, body: { locale: 'en', answers: ANSWERS } });
    // 45 days of 15-minute sensor readings (a Libre-like rhythm): evenings above 80-140, the last 3 weeks a little better.
    const start = Date.now() - 45 * 86400000; let items = []; let n = 0;
    for (let t = start; t < Date.now() - 600000; t += 15 * 60000) {
      const h = new Date(t).getHours(); const recent = t > Date.now() - 21 * 86400000;
      const v = h >= 18 && h < (recent ? 20 : 23) ? 210 : h < 6 ? 95 : 125;
      items.push({ sample_id: `e2eprog${n++}`, measured_at: new Date(t).toISOString(), value: v, unit: 'mg/dL', method: 'sensor' });
      if (items.length === 1000) { await api('/glucose/import', { method: 'POST', token: tk, body: { store: 'health_connect', items } }); items = []; }
    }
    if (items.length) await api('/glucose/import', { method: 'POST', token: tk, body: { store: 'health_connect', items } });
    const pr = (await api('/metrics/progress', { token: tk })).json;
    ok('server progress', pr.baseline && pr.status === 'sustained_improvement', pr.status);

    await page.goto(`${base}/sign-in`); await page.waitForTimeout(1500);
    await page.getByLabel('Email', { exact: true }).fill('g@example.com');
    await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
    await page.getByText('Sign in', { exact: true }).last().click(); await page.waitForTimeout(2500);
    await page.getByText('Overview', { exact: true }).last().click(); await page.waitForTimeout(3000);
    const listed = (await api('/insights', { token: tk })).json;
    ok('ranking from the server', listed.ranking && listed.ranking.served === 'rules', JSON.stringify(listed.ranking));
    await page.getByText('Month', { exact: true }).first().click(); await page.waitForTimeout(3500);
    await page.getByText('A typical day', { exact: true }).first().scrollIntoViewIfNeeded();
    ok('typical day card', await page.getByText('A typical day', { exact: true }).first().isVisible());
    await page.getByText(/left empty, not filled in/).first().scrollIntoViewIfNeeded();
    await shot('p01-typical-day');
    await page.getByText('Progress against your starting period', { exact: true }).first().scrollIntoViewIfNeeded();
    ok('trend card', await page.getByText('Progress against your starting period', { exact: true }).first().isVisible());
    ok('sustained wording', await page.getByText(/In each of the last 3 weeks/).first().isVisible());
    ok('consensus row apart', await page.getByText(/international consensus/).first().isVisible());
    await page.mouse.wheel(0, 250); await page.waitForTimeout(500);
    await shot('p02-trend');
    // Open an insight, look closer and talk it over: three kinds of event on the server.
    await page.getByText('Insights', { exact: true }).first().scrollIntoViewIfNeeded();
    const card = page.getByRole('button', { name: /night/i }).first();
    await card.click(); await page.waitForTimeout(1500);
    await page.getByText('What was left out', { exact: false }).first().click().catch(() => {});
    await page.waitForTimeout(800);
    await shot('p03-insight');
    const key = listed.ranking.order[0];
    await page.getByText('Talk it through', { exact: false }).first().click().catch(() => {});
    await page.waitForTimeout(1200);
    const ev = (await api('/insights', { token: tk })).json;
    const evs = (await api('/insights/updates', { token: tk })).status;
    ok('insight events reachable', evs === 200);
    results.push('INFO first key ' + key);
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); await global.lastPage.screenshot({ path: path.join(out, 'zz-fail.png') }); console.log('fail url', global.lastPage.url());
  }
  console.log(results.join('\n'));
  console.log(errors.length ? 'page errors:\n' + [...new Set(errors)].join('\n') : 'no page errors');
  await browser.close(); server.close();
});
