// CareLink connection end-to-end check against the test server (services/api: uvicorn tests.e2e_server:app), whose CareLink
// stand-in accepts the password "pump-pass". Usage: node tools/e2e/carelink.cjs <web export> <screenshot dir>
// Start from an empty database: it signs up c@example.com.
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
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pump: 'minimed780g', sensor: 'guardian4', pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage(); global.lastPage = page;
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`) });
  const row = async (name) => { const el = page.getByText(name, { exact: true }).last(); await el.scrollIntoViewIfNeeded(); await el.click(); await page.waitForTimeout(1500); };
  const range = `since=${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}&until=${encodeURIComponent(new Date(Date.now() + 3600000).toISOString())}`;
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'c@example.com', password: 'correct horse battery' } });
    const tp = (await api('/auth/sign-in', { method: 'POST', body: { email: 'c@example.com', password: 'correct horse battery' } })).json;
    await api('/profile', { method: 'PUT', token: tp.access_token, body: { locale: 'en', answers: ANSWERS } });
    await page.goto(`${base}/sign-in`); await page.waitForTimeout(1500);
    await page.getByLabel('Email', { exact: true }).fill('c@example.com');
    await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
    await page.getByText('Sign in', { exact: true }).last().click(); await page.waitForTimeout(2500);
    await page.getByText('Profile', { exact: true }).last().click(); await page.waitForTimeout(1500);
    await row('Devices');
    ok('carelink row', await page.getByText('MiniMed · CareLink', { exact: true }).first().isVisible());
    await row('MiniMed · CareLink');
    ok('unofficial note', await page.getByText(/this one is unofficial/).first().isVisible());
    await page.getByLabel('CareLink username', { exact: true }).fill('guy_cl');
    await page.getByLabel('CareLink password', { exact: true }).fill('wrong');
    await page.getByText('Connect', { exact: true }).last().click(); await page.waitForTimeout(2500);
    ok('wrong password said', await page.getByText('CareLink did not accept this username or password.', { exact: true }).first().isVisible());
    ok('nothing kept', (await api('/devices/carelink', { token: tp.access_token })).json.connected === false);
    await page.getByLabel('CareLink password', { exact: true }).fill('pump-pass');
    await page.getByText('Connect', { exact: true }).last().click(); await page.waitForTimeout(3000);
    ok('connected', await page.getByText('Connected as guy_cl. Readings are fetched every 5 minutes.', { exact: true }).first().isVisible());
    ok('readings added', await page.getByText('2 new readings added.', { exact: true }).first().isVisible());
    ok('pump shown', await page.getByText('Pump MMT-1880', { exact: true }).first().isVisible());
    const g = (await api(`/glucose?${range}`, { token: tp.access_token })).json;
    ok('readings stored from carelink', g.length === 2 && g.every((x) => x.source === 'carelink'), JSON.stringify(g.map((x) => [x.value, x.source])));
    await shot('c01-connected');
    await page.getByLabel('Back', { exact: true }).last().click(); await page.waitForTimeout(1500);
    ok('row says connected', await page.getByText('Connected', { exact: true }).first().isVisible());
    await row('MiniMed · CareLink');
    await page.getByText('Disconnect', { exact: true }).last().click(); await page.waitForTimeout(800);
    await page.getByText('Remove imported readings', { exact: true }).last().click(); await page.waitForTimeout(500);
    await page.getByText('Disconnect', { exact: true }).last().click(); await page.waitForTimeout(2500);
    ok('disconnected', (await api('/devices/carelink', { token: tp.access_token })).json.connected === false);
    ok('readings removed', (await api(`/glucose?${range}`, { token: tp.access_token })).json.length === 0);
    ok('form again', await page.getByLabel('CareLink password', { exact: true }).isVisible());
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); await global.lastPage.screenshot({ path: path.join(out, 'zz-fail.png') }); console.log('fail url', global.lastPage.url());
  }
  console.log(results.join('\n'));
  console.log(errors.length ? 'page errors:\n' + [...new Set(errors)].join('\n') : 'no page errors');
  await browser.close(); server.close();
});
