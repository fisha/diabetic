// Conversation end-to-end check against the test server (services/api: uvicorn tests.e2e_server:app), which stands in for the model.
// Usage: node tools/e2e/conversation.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up d@example.com.
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
    await api('/auth/sign-up', { method: 'POST', body: { email: 'd@example.com', password: 'correct horse battery' } });
    const td = (await api('/auth/sign-in', { method: 'POST', body: { email: 'd@example.com', password: 'correct horse battery' } })).json;
    await api('/profile', { method: 'PUT', token: td.access_token, body: { locale: 'en', answers: ANSWERS } });
    await page.goto(`${base}/sign-in`); await page.waitForTimeout(1500);
    await page.getByLabel('Email', { exact: true }).fill('d@example.com');
    await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
    await page.getByText('Sign in', { exact: true }).last().click(); await page.waitForTimeout(2000);
    await page.getByText('Continue in text', { exact: true }).first().click();
    await page.waitForTimeout(800);

    await say('Had a quiet morning');
    ok('companion replies', await page.getByText('Noted. It’s part of today’s conversation.').first().isVisible());
    await shot('c01-reply');

    // A reading in words opens the check card; nothing is saved until it is confirmed.
    await say('I am at 124 now');
    ok('check card opens', await page.getByText('Check what I heard').first().isVisible());
    ok('heard text shown', await page.getByText('“I am at 124 now”').first().isVisible());
    ok('nothing saved before confirming', (await api(`/glucose?${range}`, { token: td.access_token })).json.length === 0);
    await shot('c02-extract');
    await page.getByText('Save reading', { exact: true }).last().click(); await page.waitForTimeout(2500);
    const g = (await api(`/glucose?${range}`, { token: td.access_token })).json;
    ok('reading saved once', g.length === 1 && g[0].value === 124);
    ok('record row in conversation', await page.getByText('Saved', { exact: true }).first().isVisible());
    await shot('c03-record-row');

    // A reply that reads as a dose instruction is withheld; the app's own line shows instead.
    await say('what dose should I take');
    ok('dose reply withheld', await page.getByText('I can’t suggest insulin doses. That stays with you and your care team’s plan.').first().isVisible());
    ok('dose text never shown', (await page.getByText('take 4 units').count()) === 0);
    await shot('c04-dose');

    // Offline: the message stays in the composer and is not stored.
    await page.route('http://localhost:8000/**', (r) => r.abort());
    await say('Going for a walk');
    ok('send failure shown', await page.getByText('Your message wasn’t sent. Check your connection and try again.').first().isVisible());
    await page.unroute('http://localhost:8000/**');
    await page.getByLabel('Send', { exact: true }).first().click(); await page.waitForTimeout(2000);
    const thread = (await api('/conversation/messages', { token: td.access_token })).json;
    ok('retry stored once', thread.messages.filter((m) => m.text === 'Going for a walk').length === 1);
    await shot('c05-after-retry');

    // History lists the conversation in its own words.
    await page.getByLabel('Conversations', { exact: true }).first().click(); await page.waitForTimeout(1500);
    ok('history lists it', await page.getByText('Had a quiet morning').last().isVisible());
    await shot('c06-history');
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); await global.lastPage.screenshot({ path: path.join(out, 'zz-fail.png') }); console.log('fail url', global.lastPage.url());
  }
  console.log(results.join('\n'));
  console.log(errors.length ? 'page errors:\n' + [...new Set(errors)].join('\n') : 'no page errors');
  await browser.close(); server.close();
});
