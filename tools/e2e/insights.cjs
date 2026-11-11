// Insights and summary end-to-end check against the test server (services/api: uvicorn tests.e2e_server:app), which stands in for the model.
// Usage: node tools/e2e/insights.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up i@example.com.
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); global.lastPage = page;
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`) });
  const say = async (text) => {
    const box = page.getByLabel('Message Noa', { exact: false }).first();
    await box.fill(text); await page.getByLabel('Send', { exact: true }).first().click(); await page.waitForTimeout(2000);
  };
  const range = `since=${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}&until=${encodeURIComponent(new Date(Date.now() + 3600000).toISOString())}`;
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'i@example.com', password: 'correct horse battery' } });
    const ti = (await api('/auth/sign-in', { method: 'POST', body: { email: 'i@example.com', password: 'correct horse battery' } })).json;
    const answers = { ...ANSWERS, ratios: { ...ANSWERS.ratios, target: '80-140' } };
    await api('/profile', { method: 'PUT', token: ti.access_token, body: { locale: 'en', answers } });
    // Four mornings (08:00 local) above the person's own range, and one reading today in range.
    for (let i = 1; i <= 4; i++) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(8, 0, 0, 0);
      await api('/glucose', { method: 'POST', token: ti.access_token, body: { idempotency_key: `ins-e2e-${i}`, measured_at: d.toISOString(), entered_at: d.toISOString(), source: 'manual', method: 'meter', value: 200 + i, unit: 'mg/dL' } });
    }
    const today = new Date(Date.now() - 10 * 60_000);
    await api('/glucose', { method: 'POST', token: ti.access_token, body: { idempotency_key: 'ins-e2e-today', measured_at: today.toISOString(), entered_at: today.toISOString(), source: 'manual', method: 'meter', value: 110, unit: 'mg/dL' } });

    await page.goto(`${base}/sign-in`); await page.waitForTimeout(1500);
    await page.getByLabel('Email', { exact: true }).fill('i@example.com');
    await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
    await page.getByText('Sign in', { exact: true }).last().click(); await page.waitForTimeout(2500);
    await page.getByText('Overview', { exact: true }).last().click(); await page.waitForTimeout(2500);
    ok('range legend', await page.getByText(/Your range .*80–140 mg\/dL/).first().isVisible().catch(() => false));
    await page.getByText('Insights', { exact: true }).first().scrollIntoViewIfNeeded();
    ok('insight card', await page.getByText('Above your range in the morning').first().isVisible());
    await shot('i01-overview');

    await page.getByText('Above your range in the morning').first().click(); await page.waitForTimeout(1500);
    ok('detail body', await page.getByText('On 4 of the 4 days you logged readings at this time of day', { exact: false }).first().isVisible());
    await shot('i02-detail');
    await page.getByText('Useful', { exact: true }).first().click(); await page.waitForTimeout(1200);
    ok('feedback sent', await page.getByText('Thanks, noted.').first().isVisible());
    await page.getByText('Don’t show insights like this', { exact: true }).first().click(); await page.waitForTimeout(1200);
    ok('muted', await page.getByText('You won’t see this insight again.').first().isVisible());
    const after = (await api('/insights', { token: ti.access_token })).json;
    ok('server hides muted insight', after.insights.length === 0, JSON.stringify(after.insights.map((x) => x.key)));
    await shot('i03-feedback');
    await page.getByLabel('Back to overview').first().click(); await page.waitForTimeout(1500);

    // Week summary: counts and plain facts from the records.
    await page.getByText('Week', { exact: true }).first().click(); await page.waitForTimeout(2500);
    await page.getByText('Read summary', { exact: true }).first().click(); await page.waitForTimeout(1500);
    ok('summary body', await page.getByText('5 readings on 5 of 7 days.', { exact: false }).first().isVisible());
    ok('summary wins', await page.getByText('1 of 5 readings were in your range').first().isVisible());
    await shot('i04-summary');
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); await global.lastPage.screenshot({ path: path.join(out, 'zz-fail.png') }); console.log('fail url', global.lastPage.url());
  }
  console.log(results.join('\n'));
  console.log(errors.length ? 'page errors:\n' + [...new Set(errors)].join('\n') : 'no page errors');
  await browser.close(); server.close();
});
