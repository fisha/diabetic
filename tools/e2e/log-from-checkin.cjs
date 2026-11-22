// PM-408 (Guy, 22 Nov 2026): a check-in that asks for a record has a third button on the Talk screen's insights card
// that opens the matching log form. Runs against the test server (services/api: uvicorn tests.e2e_server:app).
// Usage: node tools/e2e/log-from-checkin.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir> <he|en>
// Start from an empty database. The follow-up's topic is set with psql (POST /follow-ups takes none; the companion and
// the routine set it on the server): needs PSQL_URL, for example postgresql://steady:steady@localhost:5432/steady_e2e.
const http = require('http'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; const lang = process.argv[4] || 'en'; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const L = lang === 'he' ? { log: 'לרשום ארוחה', answer: 'לענות עכשיו', read: 'סמן כנקרא', title: 'אכלת ארוחת בוקר? אפשר לרשום אותה' } : { log: 'Log meal', answer: 'Answer now', read: 'Mark as read', title: 'Had breakfast? You can log it' };
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };
const email = `log-${lang}@example.com`; const pw = 'correct horse battery';

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, locale: lang === 'he' ? 'he-IL' : 'en-US' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (n) => page.screenshot({ path: path.join(out, `${lang}-${n}.png`) });
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email, password: pw } });
    const ti = (await api('/auth/sign-in', { method: 'POST', body: { email, password: pw } })).json;
    await api('/profile', { method: 'PUT', token: ti.access_token, body: { locale: lang, answers: ANSWERS } });
    const docs = (await api('/consent', { token: ti.access_token })).json;
    await api('/consent/accept', { method: 'POST', token: ti.access_token, body: { versions: Object.fromEntries(docs.documents.map((x) => [x.kind, x.version])), at: new Date().toISOString() } });
    await api('/consent/ai', { method: 'POST', token: ti.access_token, body: { at: new Date().toISOString() } });
    const due = new Date().toISOString();
    const mk = async (key, title) => { const r = await api('/follow-ups', { method: 'POST', token: ti.access_token, body: { idempotency_key: key, title, due_at: due, kind: 'check_in' } }); if (!r.json?.id) throw new Error(`follow-up ${r.status} ${JSON.stringify(r.json)}`); return r.json.id; };
    const meal = await mk(`pm408-meal-${lang}`, L.title);
    const plain = await mk(`pm408-plain-${lang}`, lang === 'he' ? 'איך עבר היום?' : 'How was your day?');
    execFileSync('psql', [process.env.PSQL_URL, '-qc', `UPDATE follow_ups SET status='sent', sent_at=now(), topic=CASE WHEN id='${meal}' THEN 'meal' END WHERE id IN ('${meal}','${plain}')`]);

    await page.goto(`${base}/sign-in`); await page.waitForTimeout(1500);
    await page.getByLabel(lang === 'he' ? 'אימייל' : 'Email', { exact: true }).fill(email).catch(async () => page.locator('input').nth(0).fill(email));
    await page.locator('input[type=password]').first().fill(pw);
    await page.getByText(lang === 'he' ? 'כניסה' : 'Sign in', { exact: true }).last().click(); await page.waitForTimeout(6000);
    await page.getByText(L.title).first().click(); await page.waitForTimeout(1200);
    // The meal check-in has three buttons; the plain one does not get the log button.
    const logBtn = page.getByText(L.log, { exact: true });
    ok('log button on the meal check-in', (await logBtn.count()) === 1, String(await logBtn.count()));
    ok('answer and mark-as-read stay', (await page.getByText(L.answer, { exact: true }).count()) >= 1 && (await page.getByText(L.read, { exact: true }).count()) >= 1);
    await shot('01-card');
    await logBtn.first().click(); await page.waitForTimeout(2500);
    ok('opens Log a meal', page.url().includes('/meal'), page.url());
    await shot('02-meal-form');
    await page.goBack(); await page.waitForTimeout(2000);
    const card = page.getByText(lang === 'he' ? 'איך עבר היום?' : 'How was your day?');
    if ((await card.count()) === 0) { await page.getByText(L.title).first().click().catch(() => {}); await page.waitForTimeout(1000); }
    for (let i = 0; i < 4 && (await page.getByText(lang === 'he' ? 'איך עבר היום?' : 'How was your day?').count()) === 0; i++) {
      await page.getByLabel(lang === 'he' ? 'התובנה הבאה' : 'Next insight', { exact: true }).first().click().catch(() => {}); await page.waitForTimeout(600);
    }
    ok('no log button on a check-in without a topic', (await page.getByText(L.log, { exact: true }).count()) === 0 && (await page.getByText(lang === 'he' ? 'איך עבר היום?' : 'How was your day?').count()) > 0);
    await shot('03-plain-checkin');
  } catch (e) { results.push('FAIL exception — ' + e.message); try { await shot('99-error'); } catch {} }
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
