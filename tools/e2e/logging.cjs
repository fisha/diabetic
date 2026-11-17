// Logging by conversation (G-75) end-to-end check against the test server (services/api: uvicorn tests.e2e_server:app), which stands in for the model.
// Usage: node tools/e2e/conversation.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up d@example.com and h@example.com.
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
// The current legal documents are accepted up front, so the blocking read-and-accept screen does not open.
const acceptDocs = async (token) => {
  const docs = (await api('/consent', { token })).json;
  await api('/consent/accept', { method: 'POST', token, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
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
    await acceptDocs(td.access_token);
    await page.goto(`${base}/sign-in`); await page.waitForTimeout(1500);
    await page.getByLabel('Email', { exact: true }).fill('d@example.com');
    await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
    await page.getByText('Sign in', { exact: true }).last().click(); await page.waitForTimeout(2000);
    await page.getByLabel('Switch to text', { exact: true }).first().click();
    await page.waitForTimeout(800);

    // A meal told in words becomes a card with the estimate; nothing is saved until Save.
    await say('I ate rice and soup');
    ok('meal card shown', await page.getByText('Add to your journal?').first().isVisible());
    ok('foods on the card', await page.getByText('Rice, Soup').first().isVisible());
    ok('nothing saved before Save', (await api(`/records?${range}`, { token: td.access_token })).json.length === 0);
    await shot('l01-meal-card');
    await page.getByText('Save', { exact: true }).last().click(); await page.waitForTimeout(2000);
    const meals = (await api(`/records?${range}&kind=meal`, { token: td.access_token })).json;
    ok('meal saved once with its carbs', meals.length === 1 && meals[0].data.carbs_total_g === 60, JSON.stringify(meals.map((m) => m.data.carbs_total_g)));
    ok('card shows saved', await page.getByText('Saved to your journal').first().isVisible());
    await shot('l02-meal-saved');

    // Activity, saved by saying so.
    await say('I walked for half an hour');
    ok('activity card shown', await page.getByText('Walk · 30 min', { exact: false }).first().isVisible());
    await say('save it');
    const acts = (await api(`/records?${range}&kind=activity`, { token: td.access_token })).json;
    ok('activity saved by words', acts.length === 1 && acts[0].data.minutes === 30);
    await page.waitForTimeout(1500);
    ok('both cards show saved', (await page.getByText('Saved to your journal').count()) >= 2);
    await shot('l03-activity-saved');

    // A card from a finished conversation does not stay under the character on the main screen (Guy, 17 Nov 2026);
    // an unanswered one is still in the conversation, with Save, Edit and Not now.
    await api('/auth/sign-up', { method: 'POST', body: { email: 'h@example.com', password: 'correct horse battery' } });
    const th = (await api('/auth/sign-in', { method: 'POST', body: { email: 'h@example.com', password: 'correct horse battery' } })).json;
    await api('/profile', { method: 'PUT', token: th.access_token, body: { locale: 'en', answers: ANSWERS } });
    await acceptDocs(th.access_token);
    await api('/conversation/messages', { method: 'POST', token: th.access_token, body: { client_id: 'he-meal-0001', text: 'I ate rice and soup' } });
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p2 = await ctx2.newPage();
    await p2.goto(`${base}/sign-in`); await p2.waitForTimeout(1500);
    await p2.getByLabel('Email', { exact: true }).fill('h@example.com');
    await p2.getByLabel('Password', { exact: true }).fill('correct horse battery');
    await p2.getByText('Sign in', { exact: true }).last().click(); await p2.waitForTimeout(3000);
    await p2.screenshot({ path: path.join(out, 'l04-main-no-card.png') });
    ok('no card on the main screen after the conversation', (await p2.getByText('Add to your journal?').count()) === 0);
    await p2.getByLabel('Switch to text', { exact: true }).first().click(); await p2.waitForTimeout(800);
    await p2.screenshot({ path: path.join(out, 'l04-card-in-conversation.png') });
    ok('open card still in the conversation', await p2.getByText('Add to your journal?').first().isVisible() && await p2.getByText('Edit', { exact: true }).first().isVisible());
    // Edit opens the foods in the meal editor; saving there marks the card saved.
    await p2.getByText('Edit', { exact: true }).first().click(); await p2.waitForTimeout(2500);
    ok('meal editor opens with the foods', await p2.getByText('Soup').last().isVisible());
    await p2.screenshot({ path: path.join(out, 'l05-meal-editor.png') });
    await p2.getByText('Save meal', { exact: true }).last().click(); await p2.waitForTimeout(2500);
    const th2 = (await api('/conversation/messages', { token: th.access_token })).json.messages.find((m) => m.proposal);
    const hm = (await api(`/records?${range}&kind=meal`, { token: th.access_token })).json;
    ok('saved from the editor, card marked with the record', hm.length === 1 && th2.proposal_status === 'saved' && th2.proposal.record_id === hm[0].id);

    // Answering a food's question in the meal editor re-estimates its carbs (Itay, 14 Nov 2026).
    await p2.goto(`${base}/meal/describe`); await p2.waitForTimeout(2000);
    await p2.locator('textarea, input').first().fill('vegetable curry');
    await p2.getByText('Find foods', { exact: false }).last().click(); await p2.waitForTimeout(2500);
    ok('question shown with the first estimate', await p2.getByText('Mostly potato?').last().isVisible() && await p2.getByText('≈ 30 g').last().isVisible());
    await p2.getByText('Yes', { exact: true }).last().click(); await p2.waitForTimeout(2500);
    ok('answer updates the carbs', await p2.getByText('≈ 45 g').last().isVisible());
    await p2.screenshot({ path: path.join(out, 'l06-question-answered.png') });
  } catch (e) {
    ok('no exception', false, e.message);
  }
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
  process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
});
