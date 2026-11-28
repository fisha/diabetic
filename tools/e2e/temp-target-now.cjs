// The pump's temporary target on the in-app reading cards (PM-656, Guy 28 Nov 2026), end-to-end against the test server
// (services/api: uvicorn tests.e2e_server:app on port 8000). Synthetic readings and a 780G Temp Target still on (45
// minutes left) are put in the e2e database with psql, as the CareLink sync stores them; the Overview's reading tile
// and Talk's reading line must say "Temp target until <time>", and nothing once the window ended.
// Usage: PGURL=postgresql://steady@localhost:5432/steady node tools/e2e/temp-target-now.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up tt@example.com.
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
    await api('/auth/sign-up', { method: 'POST', body: { email: 'tt@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'tt@example.com', password: 'correct horse battery' } })).json.access_token;
    const uid = sql("select id from users where email = 'tt@example.com'");
    sql(`update users set approved_at = now() where id = '${uid}'`);
    const docs = (await api('/consent', { token: tk })).json;
    if (docs && docs.documents) await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    const ago = (m) => new Date(Date.now() - m * 60_000).toISOString();
    const vals = [];
    for (let m = 150, i = 0; m >= 3; m -= 5, i++) vals.push(`(gen_random_uuid(), '${uid}', 'cl-tt-g${i}', '${ago(m)}', '${ago(m)}', 'carelink', 'sensor', ${140 + (i % 7)}, 'mg/dL', ${140 + (i % 7)}, 1, false)`);
    sql(`insert into glucose_records (id, user_id, idempotency_key, measured_at, entered_at, source, method, value, unit, value_mgdl, revision, hidden) values ${vals.join(',')}`);
    sql(`insert into device_modes (id, user_id, idempotency_key, source, mode, started_at, ended_at, last_seen_at, expected_end, exact) values
      (gen_random_uuid(), '${uid}', 'carelink-temp_target-tt', 'carelink', 'temp_target', '${ago(30)}', null, '${ago(2)}', '${ago(-45)}', false)`);
    const now = (await api('/devices/modes/now', { token: tk })).json;
    ok('server says the temp target is on', now && now.target && now.target.mode === 'temp_target' && !!now.target.expected_end, JSON.stringify(now));

    for (const [lang, scheme] of [['en', 'light'], ['he', 'dark']]) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      const he = lang === 'he';
      const L = he
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', tt: /יעד זמני עד/ }
        : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', tt: /Temp target until/ };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('tt@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      await shot('01-first-tab');
      const seen = await page.getByText(L.tt).count();
      ok(`${lang}-${scheme} reading card says the temp target`, seen > 0, String(seen));
      await ctx.close();
    }
    // The window ended: nothing on the card.
    sql(`update device_modes set ended_at = now() where user_id = '${uid}'`);
    const after = (await api('/devices/modes/now', { token: tk })).json;
    ok('ended window is not now', after && after.target === null, JSON.stringify(after));
  } catch (e) {
    ok('run', false, e.message);
  } finally {
    ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    console.log(results.join('\n'));
    await browser.close(); server.close();
  }
});
