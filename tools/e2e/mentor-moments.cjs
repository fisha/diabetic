// Mentor moments (PM-432, Guy 23 Nov 2026): one card on the main screen 45 minutes before a meal the person usually
// has, in words about what they do (no glucose), with "Log meal"; and a look back after a logged meal that opens it in
// the journal. General patterns (2 h after meals, a part of the day above the range) stay on the insights page.
// Runs against the test server (services/api: uvicorn tests.e2e_server:app) with the browser and the account on UTC.
// Usage: node tools/e2e/mentor-moments.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir> <he|en>
// Start from an empty database. Meals are seeded with psql: needs PSQL_URL, for example
// postgresql://steady:steady@localhost:5432/steady_e2e.
const http = require('http'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; const lang = process.argv[4] || 'en'; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const he = lang === 'he';
const L = he
  ? { before: 'ארוחת הבוקר בקרוב', beforeLine: 'ארוחת הבוקר בדרך כלל', after: 'איך עברה ארוחת הבוקר?', afterLine: 'אפשר להסתכל עליה', log: 'לרשום ארוחה', email: 'אימייל', signIn: 'כניסה', next: 'התובנה הבאה' }
  : { before: 'Breakfast soon', beforeLine: 'Breakfast is usually around', after: 'How did breakfast go?', afterLine: 'You can look back at it', log: 'Log meal', email: 'Email', signIn: 'Sign in', next: 'Next insight' };
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };
const pw = 'correct horse battery';
const sql = (q) => execFileSync('psql', [process.env.PSQL_URL, '-qtAc', q]).toString().trim();
const hhmm = (d) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;

async function person(email, usual) {
  await api('/auth/sign-up', { method: 'POST', body: { email, password: pw } });
  const ti = (await api('/auth/sign-in', { method: 'POST', body: { email, password: pw } })).json;
  await api('/profile', { method: 'PUT', token: ti.access_token, body: { locale: lang, answers: ANSWERS } });
  const docs = (await api('/consent', { token: ti.access_token })).json;
  await api('/consent/accept', { method: 'POST', token: ti.access_token, body: { versions: Object.fromEntries(docs.documents.map((x) => [x.kind, x.version])), at: new Date().toISOString() } });
  const uid = sql(`SELECT id FROM users WHERE email='${email}'`);
  sql(`UPDATE users SET created_at = now() - interval '40 days' WHERE id='${uid}'`);
  // Breakfast at the usual time on 5 of the last 12 days: 7 days without it logged.
  for (const d of [1, 2, 3, 10, 12]) {
    sql(`INSERT INTO records (id, user_id, idempotency_key, kind, occurred_at, entered_at, source, data, revision) VALUES (gen_random_uuid(), '${uid}', 'mm-${d}', 'meal', date_trunc('day', now()) - interval '${d} days' + time '${usual}', now(), 'manual', '{"items":[],"ate":"all","carbs_total_g":40,"any_unknown":false}', 1)`);
  }
  return { uid, token: ti.access_token };
}

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  const open = async (email, name) => {
    const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 2, locale: he ? 'he-IL' : 'en-US', timezoneId: 'UTC' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}/sign-in`); await page.waitForTimeout(1500);
    await page.getByLabel(L.email, { exact: true }).fill(email).catch(async () => page.locator('input').nth(0).fill(email));
    await page.locator('input[type=password]').first().fill(pw);
    await page.getByText(L.signIn, { exact: true }).last().click(); await page.waitForTimeout(7000);
    return { page, shot: (n) => page.screenshot({ path: path.join(out, `${lang}-${name}-${n}.png`) }) };
  };
  try {
    // Before: the usual breakfast is 20 minutes from now.
    const soon = new Date(Date.now() + 20 * 60_000);
    const a = await person(`mm-before-${lang}@example.com`, hhmm(soon));
    const m = (await api('/insights/moment', { token: a.token })).json;
    ok('the server has a moment before breakfast', m && m.phase === 'before' && m.kind === 'log', JSON.stringify(m));
    ok('no glucose words before the meal', m && !/glucose|sugar|insulin|high|low|will|likely|סוכר|אינסולין|גבוה|נמוך|צפוי|עלול/i.test(m.title + m.body));
    const b = await open(`mm-before-${lang}@example.com`, 'before');
    await b.shot('01-home');
    // The insights line shows the first card's words (the moment is first); a tap opens the card.
    ok('the insights line shows the moment first', (await b.page.getByText(L.beforeLine).count()) > 0);
    await b.page.getByText(L.beforeLine).first().click().catch(() => {});
    await b.page.waitForTimeout(1200);
    ok('the moment card shows on the main screen', (await b.page.getByText(L.before).count()) > 0);
    ok('it offers Log meal', (await b.page.getByText(L.log, { exact: true }).count()) === 1);
    await b.shot('02-moment-before');
    // After: breakfast logged today, two hours and more ago, after the moment was shown.
    const early = new Date(Date.now() - 2 * 3_600_000 - 15 * 60_000);
    const c = await person(`mm-after-${lang}@example.com`, hhmm(early));
    const today = new Date().toISOString().slice(0, 10);
    sql(`INSERT INTO records (id, user_id, idempotency_key, kind, occurred_at, entered_at, source, data, revision) VALUES (gen_random_uuid(), '${c.uid}', 'mm-today', 'meal', '${early.toISOString()}', now(), 'manual', '{"items":[],"ate":"all","carbs_total_g":40,"any_unknown":false}', 1)`);
    const state = { moments: { day: today, pick: { s: 'breakfast', l: 'log', t: hhmm(early), n: 7, of: 12 }, hist: [{ d: today, s: 'breakfast', l: 'log', shown: true }], rest: {} } };
    sql(`INSERT INTO user_settings (user_id, timezone, memory_enabled, routine_state) VALUES ('${c.uid}', 'UTC', true, '${JSON.stringify(state)}') ON CONFLICT (user_id) DO UPDATE SET routine_state = EXCLUDED.routine_state, timezone = 'UTC'`);
    const mb = (await api('/insights/moment', { token: c.token })).json;
    ok('the server has a look back after breakfast', mb && mb.phase === 'after' && !!mb.record_id, JSON.stringify(mb));
    const d = await open(`mm-after-${lang}@example.com`, 'after');
    await d.shot('03-home');
    await d.page.getByText(L.afterLine).first().click().catch(() => {});
    await d.page.waitForTimeout(1200);
    ok('the look back shows', (await d.page.getByText(L.after).count()) > 0);
    await d.shot('04-moment-after');
    await d.page.getByText(L.after).first().click().catch(() => {});
    await d.page.waitForTimeout(2500);
    ok('the look back opens the journal at that meal', d.page.url().includes('/journal'), d.page.url());
    await d.shot('05-journal');
  } catch (e) { results.push('FAIL exception — ' + e.message); }
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
