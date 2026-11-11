// Voice end-to-end check against the test server (services/api: uvicorn tests.e2e_server:app), which stands in for the model.
// Usage: node tools/e2e/voice.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up v@example.com.
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
  // A fake microphone (a tone) and an automatic permission grant stand in for the person talking.
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] });
  const page = await ctx.newPage(); global.lastPage = page;
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`) });
  const say = async (text) => {
    const box = page.getByLabel('Message Noa', { exact: false }).first();
    await box.fill(text); await page.getByLabel('Send', { exact: true }).first().click(); await page.waitForTimeout(2000);
  };
  const range = `since=${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}&until=${encodeURIComponent(new Date(Date.now() + 3600000).toISOString())}`;
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'v@example.com', password: 'correct horse battery' } });
    const tv = (await api('/auth/sign-in', { method: 'POST', body: { email: 'v@example.com', password: 'correct horse battery' } })).json;
    await api('/profile', { method: 'PUT', token: tv.access_token, body: { locale: 'en', answers: ANSWERS } });
    await page.goto(`${base}/sign-in`); await page.waitForTimeout(1500);
    await page.getByLabel('Email', { exact: true }).fill('v@example.com');
    await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
    await page.getByText('Sign in', { exact: true }).last().click(); await page.waitForTimeout(2500);

    ok('voice ready', await page.getByText('Tap to talk', { exact: true }).first().isVisible());
    await shot('v01-idle');
    // Live voice: the companion opens, then listens; the reply audio plays only after the server checked its words.
    await page.getByRole('button', { name: 'Talk', exact: true }).click();
    await page.getByText('Good evening! How was your day?').first().waitFor({ timeout: 5000 }).catch(() => {});
    ok('companion greets first', await page.getByText('Good evening! How was your day?').first().isVisible());
    await shot('v02-greeting');
    // The stand-in hears "My reading is 142" after a second of the fake microphone: the check card opens.
    await page.getByText('Check what I heard').first().waitFor({ timeout: 8000 });
    ok('check card opens', await page.getByText('Check what I heard').first().isVisible());
    ok('heard text shown', await page.getByText('“My reading is 142”').first().isVisible());
    await shot('v03-card');
    const conv = (await api('/conversation/messages', { token: tv.access_token })).json;
    const mine = conv.messages.find((m) => m.role === 'user');
    ok('message stored as voice', mine && mine.via === 'voice' && mine.text === 'My reading is 142', JSON.stringify(mine && [mine.via, mine.text]));
    await page.getByText('Save reading', { exact: true }).last().click(); await page.waitForTimeout(2500);
    const range = `since=${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}&until=${encodeURIComponent(new Date(Date.now() + 3600000).toISOString())}`;
    const g = (await api(`/glucose?${range}`, { token: tv.access_token })).json;
    ok('reading saved once', g.length === 1 && g[0].value === 142, JSON.stringify(g.map((x) => [x.value, x.source])));
    const texts = (await api('/conversation/messages', { token: tv.access_token })).json.messages.map((m) => m.text);
    ok('spoken turns stored in order', JSON.stringify(texts) === JSON.stringify(['Good evening! How was your day?', 'My reading is 142', 'Thanks, check the card.']), JSON.stringify(texts));
    ok('still listening', await page.getByText('Listening', { exact: true }).first().isVisible());
    await shot('v04-listening');
    await page.getByRole('button', { name: 'Finish', exact: true }).click(); await page.waitForTimeout(1000);
    ok('finish ends the conversation', await page.getByText('Tap to talk', { exact: true }).first().isVisible());

    // Mute: talking is off until unmuted.
    await page.getByRole('button', { name: 'Mute', exact: true }).click(); await page.waitForTimeout(500);
    ok('muted state', await page.getByText('Microphone muted', { exact: true }).first().isVisible());
    ok('talk disabled while muted', await page.getByRole('button', { name: 'Talk', exact: true }).isDisabled());
    await shot('v05-muted');
    await page.getByRole('button', { name: 'Unmute', exact: true }).click(); await page.waitForTimeout(500);
    ok('unmuted', await page.getByText('Tap to talk', { exact: true }).first().isVisible());

    // Speech of another account's reply is refused.
    await api('/auth/sign-up', { method: 'POST', body: { email: 'w@example.com', password: 'correct horse battery' } });
    const tw = (await api('/auth/sign-in', { method: 'POST', body: { email: 'w@example.com', password: 'correct horse battery' } })).json;
    const reply = conv.messages.find((m) => m.role === 'assistant');
    const r = await fetch(`${API}/voice/messages/${reply.id}/speech`, { headers: { authorization: `Bearer ${tw.access_token}` } });
    ok('other account cannot hear the reply', r.status === 404, String(r.status));
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); await global.lastPage.screenshot({ path: path.join(out, 'zz-fail.png') }); console.log('fail url', global.lastPage.url());
  }
  console.log(results.join('\n'));
  console.log(errors.length ? 'page errors:\n' + [...new Set(errors)].join('\n') : 'no page errors');
  await browser.close(); server.close();
});
