// Pump modes in the journal (Guy, 16 Nov 2026: Sport mode on the pump was missing; every reading and insulin dose during
// it gets a "Sport mode" badge), end-to-end against the test server (services/api: uvicorn tests.e2e_server:app on port
// 8000). Synthetic pump readings, a bolus and two Temp Target windows (one ended, one still on) are put in the e2e
// database with psql, as the CareLink sync stores them.
// Usage: PGURL=postgresql://steady:steady@localhost:5432/steady_e2e node tools/e2e/pump-modes.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up m@example.com.
const http = require('http'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const PG = process.env.PGURL || 'postgresql://steady:steady@localhost:5432/steady_e2e';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const sql = (q) => execFileSync('psql', [PG, '-tAc', q]).toString().trim();
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'm@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'm@example.com', password: 'correct horse battery' } })).json.access_token;
    const uid = sql("select id from users where email = 'm@example.com'");
    sql(`update users set approved_at = now() where id = '${uid}'`);
    const docs = (await api('/consent', { token: tk })).json;
    if (docs && docs.documents) await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    const ago = (m) => new Date(Date.now() - m * 60_000).toISOString();
    // Readings every 15 minutes for the last 2.5 hours; Sport mode from 120 to 60 minutes ago, and on again from 20
    // minutes ago (45 minutes left on the pump).
    const vals = [];
    for (let m = 150, i = 0; m >= 5; m -= 15, i++) vals.push(`(gen_random_uuid(), '${uid}', 'cl-e2e-g${i}', '${ago(m)}', '${ago(m)}', 'carelink', 'sensor', ${120 + i * 3}, 'mg/dL', ${120 + i * 3}, 1, false)`);
    sql(`insert into glucose_records (id, user_id, idempotency_key, measured_at, entered_at, source, method, value, unit, value_mgdl, revision, hidden) values ${vals.join(',')}`);
    const bolus = JSON.stringify({ insulin: 'Pump', units: 1.2, reason: 'pump bolus' });
    sql(`insert into records (id, user_id, idempotency_key, kind, occurred_at, entered_at, source, data, revision, hidden) values
      (gen_random_uuid(), '${uid}', 'cl-e2e-bolus', 'insulin', '${ago(90)}', '${ago(90)}', 'carelink', '${bolus}', 1, false)`);
    sql(`insert into device_modes (id, user_id, idempotency_key, source, mode, started_at, ended_at, last_seen_at, expected_end, exact) values
      (gen_random_uuid(), '${uid}', 'carelink-temp_target-1', 'carelink', 'temp_target', '${ago(122)}', '${ago(61)}', '${ago(64)}', null, false),
      (gen_random_uuid(), '${uid}', 'carelink-temp_target-2', 'carelink', 'temp_target', '${ago(21)}', null, '${ago(1)}', '${ago(-45)}', false)`);
    const range = `since=${encodeURIComponent(ago(24 * 60))}&until=${encodeURIComponent(ago(-60))}`;
    const modes = (await api(`/devices/modes?${range}`, { token: tk })).json;
    ok('server lists both windows', Array.isArray(modes) && modes.length === 2 && modes[1].ended_at === null && !!modes[1].expected_end, JSON.stringify(modes && modes.map((x) => [x.mode, !!x.ended_at])));

    const runs = process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']];
    for (const [lang, scheme] of runs) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage(); global.lastPage = page;
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      const he = lang === 'he';
      const L = he
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', tab: 'יומן', title: 'מצב ספורט (יעד זמני)', badge: 'מצב ספורט', alerts: 'התראות', approx: 'CareLink מציג את המצב הזה רק בזמן שהוא פעיל' }
        : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', tab: 'Journal', title: 'Temp Target (Sport mode)', badge: 'Sport mode', alerts: 'Alerts', approx: 'CareLink shows this mode only while it runs' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('m@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await page.getByRole('tab', { name: L.tab, exact: true }).click(); await page.waitForTimeout(3000);
      await shot('01-journal');
      const rows = await page.getByText(L.title, { exact: true }).count();
      ok(`${lang}-${scheme} two mode rows`, rows === 2, String(rows));
      const badges = await page.getByText(L.badge, { exact: true }).count();
      // Readings 120, 105, 90 (with the bolus merged in) and 75 minutes ago in the first window, 15 minutes ago in the
      // second: 5 badges; 135 and 60 minutes ago are outside.
      ok(`${lang}-${scheme} readings and insulin in the windows carry the badge`, badges === 5, String(badges));
      await page.getByText(L.title, { exact: true }).last().scrollIntoViewIfNeeded();
      await shot('02-journal-earlier');
      await page.getByText(L.title, { exact: true }).first().click(); await page.waitForTimeout(1200);
      ok(`${lang}-${scheme} detail says the times are from the polls`, await page.getByText(new RegExp(L.approx)).first().isVisible());
      await shot('03-mode-detail');
      await page.goto(base); await page.waitForTimeout(1000);
      await ctx.close();
    }
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); if (global.lastPage) await global.lastPage.screenshot({ path: path.join(out, 'zz-fail.png') });
  }
  console.log(results.join('\n'));
  console.log(errors.length ? 'page errors:\n' + [...new Set(errors)].join('\n') : 'no page errors');
  await browser.close(); server.close();
});
