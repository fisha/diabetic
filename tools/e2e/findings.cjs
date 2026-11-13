// Routine findings (G-38) end-to-end check against the test server (services/api: uvicorn tests.e2e_server:app), which stands in for the model.
// Usage: node tools/e2e/insights.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up r@example.com.
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
    await api('/auth/sign-up', { method: 'POST', body: { email: 'r@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'r@example.com', password: 'correct horse battery' } })).json.access_token;
    await api('/profile', { method: 'PUT', token: tk, body: { locale: 'en', answers: { ...ANSWERS, ratios: { ...ANSWERS.ratios, target: '80-140' } } } });
    // Pasta lunch on four days: 160 before, 230 two hours later.
    for (let i = 1; i <= 4; i++) {
      const m = new Date(); m.setDate(m.getDate() - i); m.setHours(13, 0, 0, 0);
      const later = new Date(m.getTime() + 2 * 3600_000);
      await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `fd-meal-${i}`, kind: 'meal', occurred_at: m.toISOString(), entered_at: m.toISOString(), source: 'manual', data: { items: [{ name: 'Pasta', unit: 'g', qty: 200, carbs_g: 60, prov: 'user' }], ate: 'all', carbs_total_g: 60, any_unknown: false } } });
      for (const [k, at, v] of [['a', m, 160], ['b', later, 230]]) {
        await api('/glucose', { method: 'POST', token: tk, body: { idempotency_key: `fd-g-${i}-${k}`, measured_at: at.toISOString(), entered_at: at.toISOString(), source: 'manual', method: 'sensor', value: v, unit: 'mg/dL' } });
      }
    }
    const ins = (await api('/insights', { token: tk })).json;
    ok('finding on server', ins.findings.some((f) => f.key === 'food:pasta' && f.tone === 'watch'));
    ok('lunch before and after', ins.meal_patterns.some((p) => p.key === 'rise:lunch' && p.start_mgdl === 160 && p.end_mgdl === 230));

    await page.goto(`${base}/sign-in`); await page.waitForTimeout(1500);
    await page.getByLabel('Email', { exact: true }).fill('r@example.com');
    await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
    await page.getByText('Sign in', { exact: true }).last().click(); await page.waitForTimeout(2500);
    await page.getByRole('tab', { name: 'Overview', exact: true }).click(); await page.waitForTimeout(2500);
    await page.getByText('Insights', { exact: true }).first().scrollIntoViewIfNeeded();
    ok('food card', await page.getByText('After Pasta: usually above your range').first().isVisible());
    await shot('r01-overview');
    await page.getByText('After Pasta: usually above your range').first().click(); await page.waitForTimeout(1500);
    ok('before and after values', await page.getByText('Before eating you were around 160 mg/dL; two hours later around 230 mg/dL', { exact: false }).first().isVisible());
    ok('carb advice', await page.getByText('are the carbs counted fully', { exact: false }).first().isVisible());
    await shot('r02-detail');
    await page.goBack(); await page.waitForTimeout(1200);
    await page.getByText('Two hours after lunch', { exact: true }).first().click(); await page.waitForTimeout(1500);
    ok('lunch wording', await page.getByText('Before lunch you were usually around 160 mg/dL', { exact: false }).first().isVisible());
    await shot('r03-lunch');
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); await global.lastPage.screenshot({ path: path.join(out, 'zz-fail.png') });
  }
  console.log(results.join('\n')); console.log(errors.length ? 'page errors: ' + errors.join(' | ') : 'no page errors');
  await browser.close(); server.close();
});
