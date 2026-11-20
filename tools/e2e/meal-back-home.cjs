// "Back to main screen" after a meal is saved (Guy, 17 Nov 2026) returns to the companion's voice view, not the text
// conversation the meal was opened from. Against the test server (services/api: uvicorn tests.e2e_server:app).
// Usage: node tools/e2e/meal-back-home.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up h5@example.com.
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
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`) });
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'h5@example.com', password: 'correct horse battery' } });
    const tf = (await api('/auth/sign-in', { method: 'POST', body: { email: 'h5@example.com', password: 'correct horse battery' } })).json;
    await api('/profile', { method: 'PUT', token: tf.access_token, body: { locale: 'en', answers: ANSWERS } });
    await page.goto(`${base}/sign-in`); await page.waitForTimeout(1500);
    await page.getByLabel('Email', { exact: true }).fill('h5@example.com');
    await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
    await page.getByText('Sign in', { exact: true }).last().click(); await page.waitForTimeout(3500);
    // A new account answers who it is for first.
    if (await page.getByText('Who are you here for?').first().isVisible().catch(() => false)) {
      await page.getByText('For myself', { exact: true }).first().click();
      await page.getByText('Continue', { exact: true }).last().click(); await page.waitForTimeout(3500);
    }
    // The current terms and privacy policy are accepted on a new account's first open.
    if (await page.getByText('Agree and continue', { exact: true }).last().isVisible().catch(() => false)) {
      await page.getByText('Agree and continue', { exact: true }).last().click(); await page.waitForTimeout(3500);
    }

    // The text conversation, then the meal flow from its plus.
    await page.getByRole('button', { name: 'Switch to text' }).first().click(); await page.waitForTimeout(800);
    ok('text conversation open', await page.getByRole('button', { name: 'Voice' }).first().isVisible().catch(() => false));
    await shot('h01-text');
    await page.getByRole('button', { name: 'Quick log' }).first().click(); await page.waitForTimeout(1000);
    await shot('h02-log-sheet');
    await page.getByText('Meal', { exact: true }).last().click(); await page.waitForTimeout(1500);
    await page.getByText('Describe by voice or text', { exact: true }).last().click(); await page.waitForTimeout(1000);
    await page.locator('textarea').first().fill('banana');
    await page.getByText('Find foods', { exact: true }).last().click(); await page.waitForTimeout(2500);
    await page.getByText(/^Save meal/).last().click(); await page.waitForTimeout(2000);
    ok('meal saved', await page.getByText('Meal saved').first().isVisible());
    await shot('h03-saved');
    await page.getByText('Back to main screen', { exact: true }).last().click(); await page.waitForTimeout(2000);
    await shot('h04-after-back');
    ok('main screen (voice view) shown', await page.getByRole('button', { name: 'Switch to text' }).first().isVisible().catch(() => false));
    ok('not the text conversation', !(await page.getByRole('button', { name: 'Voice' }).first().isVisible().catch(() => false)));
    ok('no page errors', errors.length === 0, errors.join(' | '));
  } catch (e) {
    ok('script ran', false, String(e)); await shot('hxx-error').catch(() => {});
  }
  console.log(results.join('\n'));
  await browser.close(); server.close();
  process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
});
