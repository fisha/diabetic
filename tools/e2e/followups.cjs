// Follow-ups and memory end-to-end check against the test server (services/api: uvicorn tests.e2e_server:app).
// Usage: node tools/e2e/followups.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up e@example.com.
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
  const tab = async (name) => { await page.getByRole('tab', { name, exact: true }).click(); await page.waitForTimeout(1800); };
  const say = async (text) => {
    await page.getByLabel('Message Noa', { exact: false }).first().fill(text);
    await page.getByLabel('Send', { exact: true }).first().click(); await page.waitForTimeout(2000);
  };
  const range = `since=${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}&until=${encodeURIComponent(new Date(Date.now() + 3 * 86400000).toISOString())}`;
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'e@example.com', password: 'correct horse battery' } });
    const te = (await api('/auth/sign-in', { method: 'POST', body: { email: 'e@example.com', password: 'correct horse battery' } })).json;
    await api('/profile', { method: 'PUT', token: te.access_token, body: { locale: 'en', answers: ANSWERS } });
    await page.goto(`${base}/sign-in`); await page.waitForTimeout(1500);
    await page.getByLabel('Email', { exact: true }).fill('e@example.com');
    await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
    await page.getByText('Sign in', { exact: true }).last().click(); await page.waitForTimeout(2500);
    ok('time zone reported', (await api('/settings', { token: te.access_token })).json.timezone !== '');

    // Reminder sheet.
    await tab('Companion');
    await page.getByText('Reminder', { exact: true }).first().click(); await page.waitForTimeout(1200);
    await page.getByLabel('What', { exact: true }).fill('Check glucose after lunch');
    await page.getByText('In 2 hours', { exact: true }).click();
    await page.getByText('Schedule reminder', { exact: true }).last().click(); await page.waitForTimeout(2000);
    ok('reminder toast', await page.getByText('Reminder scheduled').first().isVisible());
    let fus = (await api(`/follow-ups?${range}`, { token: te.access_token })).json;
    ok('reminder on server', fus.length === 1 && fus[0].title === 'Check glucose after lunch' && fus[0].status === 'scheduled');

    // Conversation schedules a follow-up and saves a memory through tools.
    await page.getByLabel('Switch to text', { exact: true }).first().click(); await page.waitForTimeout(600);
    await say('remind me to take a walk');
    ok('model confirms from tool result', await page.getByText('Okay, I scheduled it.').first().isVisible());
    await say('remember I prefer short replies');
    fus = (await api(`/follow-ups?${range}`, { token: te.access_token })).json;
    ok('conversation follow-up on server', fus.some((f) => f.origin === 'conversation' && f.title === 'to take a walk'));
    const mems = (await api('/memories', { token: te.access_token })).json;
    ok('memory on server', mems.length === 1 && mems[0].text === 'I prefer short replies');
    // An impression the companion saved is kept apart from what the person said (G-37).
    await say('remember it seems I skip breakfast');
    const imp = (await api('/memories', { token: te.access_token })).json;
    ok('impression on server', imp.length === 2 && imp[1].kind === 'impression');

    // Journal shows the reminder with its lifecycle (the one due in minutes: "in 2 hours" can fall on tomorrow's page).
    await tab('Journal');
    ok('journal reminder', await page.getByText('to take a walk').first().isVisible());
    await page.getByText('to take a walk', { exact: true }).last().click(); await page.waitForTimeout(800);
    await shot('f01-journal-reminder');
    ok('lifecycle shown', await page.getByText('Scheduled', { exact: true }).first().isVisible());
    await page.getByText('Change, snooze or cancel', { exact: true }).click(); await page.waitForTimeout(1500);

    // Routine: check-ins tab lists them; snooze one; memory tab lists the memory and removes it.
    await page.getByText('Check-ins', { exact: true }).first().click(); await page.waitForTimeout(1500);
    await shot('f02-routine-checkins');
    ok('routine lists reminder', await page.getByText('Check glucose after lunch').last().isVisible());
    await page.getByText('Snooze', { exact: true }).first().click(); await page.waitForTimeout(1500);
    fus = (await api(`/follow-ups?${range}`, { token: te.access_token })).json;
    ok('snoozed on server', fus.some((f) => f.status === 'snoozed'));
    await page.getByText('Memory', { exact: true }).first().click(); await page.waitForTimeout(1500);
    await shot('f03-memory');
    ok('memory listed', await page.getByText('I prefer short replies').last().isVisible());
    ok('impression marked', await page.getByText('impression, not confirmed', { exact: false }).last().isVisible());
    await page.getByText('Remove all memories', { exact: true }).click(); await page.waitForTimeout(1500);
    ok('memories removed', (await api('/memories', { token: te.access_token })).json.length === 0);

    // Routine tab: the first days from the server (G-36).
    await page.getByText('Routine', { exact: true }).first().click(); await page.waitForTimeout(1500);
    await shot('f04-first-days');
    ok('first days card', await page.getByText('Day 1 of about 3').first().isVisible());
    ok('still unknown listed', await page.getByText('your usual breakfast time', { exact: false }).first().isVisible());
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); await global.lastPage.screenshot({ path: path.join(out, 'zz-fail.png') }); console.log('fail url', global.lastPage.url());
  }
  console.log(results.join('\n'));
  console.log(errors.length ? 'page errors:\n' + [...new Set(errors)].join('\n') : 'no page errors');
  await browser.close(); server.close();
});
