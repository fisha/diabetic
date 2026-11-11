// Account and privacy end-to-end check against the test server (services/api: uvicorn tests.e2e_server:app), which stands in for the model.
// Usage: node tools/e2e/account.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up p@example.com.
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await ctx.newPage(); global.lastPage = page;
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`) });
  const say = async (text) => {
    const box = page.getByLabel('Message Noa', { exact: false }).first();
    await box.fill(text); await page.getByLabel('Send', { exact: true }).first().click(); await page.waitForTimeout(2000);
  };
  const range = `since=${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}&until=${encodeURIComponent(new Date(Date.now() + 3600000).toISOString())}`;
  const row = async (name) => { const el = page.getByText(name, { exact: true }).last(); await el.scrollIntoViewIfNeeded(); await el.click(); await page.waitForTimeout(1500); };
  const toProfile = async () => { await page.getByText('Profile', { exact: true }).last().click(); await page.waitForTimeout(1500); };
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'p@example.com', password: 'correct horse battery' } });
    const tp = (await api('/auth/sign-in', { method: 'POST', body: { email: 'p@example.com', password: 'correct horse battery' } })).json;
    await api('/profile', { method: 'PUT', token: tp.access_token, body: { locale: 'en', answers: ANSWERS } });
    const at = new Date(Date.now() - 3600_000).toISOString();
    await api('/glucose', { method: 'POST', token: tp.access_token, body: { idempotency_key: 'acc-e2e-1', measured_at: at, entered_at: at, source: 'manual', method: 'meter', value: 131, unit: 'mg/dL' } });
    await page.goto(`${base}/sign-in`); await page.waitForTimeout(1500);
    await page.getByLabel('Email', { exact: true }).fill('p@example.com');
    await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
    await page.getByText('Sign in', { exact: true }).last().click(); await page.waitForTimeout(2500);

    // A settings change reaches the server profile.
    await toProfile(); await row('Privacy and data');
    await page.getByRole('switch', { name: 'Help improve models' }).click(); await page.waitForTimeout(2500);
    const prof = (await api('/profile', { token: tp.access_token })).json;
    ok('consent change saved to server', prof.answers.consent.training === true, JSON.stringify(prof.answers.consent));
    await page.getByText('Delete after analysis', { exact: true }).first().click(); await page.waitForTimeout(1200);
    ok('photo choice saved to server', (await api('/settings', { token: tp.access_token })).json.photo_retention === 'afterAnalysis');
    await shot('p01-privacy');

    // Export: created on the server, then downloaded.
    await row('Export your data');
    await page.getByText('Create export', { exact: true }).last().click(); await page.waitForTimeout(4000);
    ok('export ready', await page.getByText('Export ready', { exact: true }).first().isVisible());
    ok('file line', await page.getByText(/steady-export-.*\.pdf · .*KB/).first().isVisible());
    await shot('p02-export-ready');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.getByText('Share or save', { exact: true }).last().click()]);
    const file = await dl.path(); const bytes = fs.readFileSync(file);
    ok('downloaded a PDF', bytes.slice(0, 4).toString() === '%PDF', dl.suggestedFilename());

    // Delete the account.
    for (let i = 0; i < 2; i++) { await page.getByLabel('Back', { exact: true }).last().click(); await page.waitForTimeout(1000); }
    await row('Delete account');
    await page.getByLabel('Type DELETE to confirm', { exact: true }).fill('DELETE');
    await page.getByText('Delete account permanently', { exact: true }).last().click(); await page.waitForTimeout(3000);
    ok('deleted screen', await page.getByText('Your account is deleted', { exact: true }).first().isVisible());
    await shot('p03-deleted');
    ok('server refuses sign-in', (await api('/auth/sign-in', { method: 'POST', body: { email: 'p@example.com', password: 'correct horse battery' } })).status === 401);
    await page.getByText('Close', { exact: true }).last().click(); await page.waitForTimeout(1500);
    ok('back at welcome', page.url().endsWith('/welcome'), page.url());
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); await global.lastPage.screenshot({ path: path.join(out, 'zz-fail.png') }); console.log('fail url', global.lastPage.url());
  }
  console.log(results.join('\n'));
  console.log(errors.length ? 'page errors:\n' + [...new Set(errors)].join('\n') : 'no page errors');
  await browser.close(); server.close();
});
