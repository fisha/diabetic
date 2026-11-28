// Overview's sensor and infusion set sheets (PM-647, Guy 28 Nov 2026): tapping each row opens a sheet with everything
// the device services reported, estimates marked; a follower's rows stay view only.
// Usage: node tools/e2e/equipment-sheets.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Against the test server (services/api: uvicorn tests.e2e_server:app) from an empty database (env as in
// set-change-recommended.cjs). Seeds the CareLink pump status straight into the database with psql (PGHOST, database
// `steady`), because the stand-in CareLink sends no sensor life. ONLY=he:dark runs one look.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token, headers = {} } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const sql = (q) => execFileSync('psql', ['-U', 'steady', '-d', process.env.PGDB || 'steady', '-qtAc', q], { encoding: 'utf8' });
const ANSWERS = { version: 1, infusionSet: 'standard', consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '70-180' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };
const PW = 'correct horse battery';
const tab = (page, name) => page.getByRole('tab', { name }).first().click({ timeout: 3000 }).catch(() => page.getByText(name, { exact: true }).last().click());
let lastPage = null;
const sessions = {};

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    const account = async (email, name) => {
      await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
      const si = (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json;
      const tk = si.access_token; sessions[email] = si;
      await api('/profile', { method: 'PUT', token: tk, body: { locale: 'en', answers: { ...ANSWERS, companion: { ...ANSWERS.companion, callMe: name } } } });
      const docs = (await api('/consent', { token: tk })).json;
      await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
      await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
      return tk;
    };
    const me = await account('me@example.com', 'Guy');
    const parent = await account('parent@example.com', 'Dad');
    const cl = await api('/devices/carelink', { method: 'PUT', token: me, body: { username: 'me_cl', password: 'pump-pass' } });
    ok('CareLink connected', cl.status === 200, String(cl.status));
    await api('/settings', { method: 'PATCH', token: me, body: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
    // The pump's own state: 2 d 5 h of sensor life, a calibration asked for, transmitter 80%, reservoir 112.5 U.
    const now = new Date();
    const status = { at: now.toISOString(), pump_at: new Date(now - 3 * 60000).toISOString(), sensor_hours_left: 53, sensor_minutes_left: 53 * 60 + 20, sensor_state: 'CALIBRATION_REQUIRED', transmitter_battery_percent: 80, sensor_in_range: true, pump_in_range: true, reservoir_units: 112.5, reservoir_percent: 45 };
    sql(`update device_links set device = jsonb_set(coalesce(device::jsonb, '{}'::jsonb), '{status}', '${JSON.stringify(status)}'::jsonb)::json, last_reading_at = now() - interval '4 minutes', last_sync_at = now() - interval '1 minute' where kind = 'carelink'`);
    const uid = sql(`select id from users where email = 'me@example.com'`).trim();
    const ev = (code, ago, key) => sql(`insert into device_events (id, user_id, idempotency_key, source, occurred_at, kind, code) values (gen_random_uuid(), '${uid}', '${key}', 'carelink', now() - interval '${ago}', 'event', '${code}')`);
    ev('797', '4 days 18 hours', 'e2e-797-a'); ev('797', '11 days 20 hours', 'e2e-797-b');
    // The set: changed 1 day 3 hours ago (said in the app), the one before on a CareLink history day (day only).
    const sc = await api('/devices/set-change', { method: 'POST', token: me, body: { at: new Date(now - (27 * 3600000)).toISOString() } });
    ok('set change logged', sc.status === 200, String(sc.status));
    const d4 = new Date(now); d4.setDate(d4.getDate() - 4); d4.setHours(0, 0, 0, 0);
    sql(`insert into device_events (id, user_id, idempotency_key, source, occurred_at, kind, code) values (gen_random_uuid(), '${uid}', 'carelink-set_change-e2e', 'carelink', '${d4.toISOString()}', 'event', 'set_change')`);
    const det = (await api('/devices/equipment/details', { token: me })).json;
    ok('details: pump sensor end, not an estimate', det.sensors.length === 1 && det.sensors[0].ends_at && det.sensors[0].ends_estimate === false, JSON.stringify(det.sensors[0]).slice(0, 300));
    ok('details: set exact last change and a day-only earlier one', det.set.last && det.set.last.exact && det.set.earlier.length === 1 && det.set.earlier[0].exact === false, JSON.stringify(det.set).slice(0, 300));
    const code = (await api('/sharing/invites', { method: 'POST', token: me, body: { scopes: ['glucose'], relation: 'family', consent: true } })).json.code;
    const acc = await api('/sharing/accept', { method: 'POST', token: parent, body: { code } });
    const viewed = await api('/devices/equipment/details', { token: parent, headers: { 'X-View-As': acc.json.owner_id } });
    ok('a follower cannot read the details', viewed.status === 403, String(viewed.status));

    const looks = process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark'], ['en', 'dark']];
    for (const [lang, scheme] of looks) {
      const he = lang === 'he';
      await api('/profile', { method: 'PUT', token: me, body: { locale: lang, answers: { ...ANSWERS, companion: { ...ANSWERS.companion, callMe: 'Guy' } } } });
      const T = he ? { overview: 'סקירה', set: 'סט עירוי', sensor: 'חיישן', calib: 'המשאבה מבקשת כיול', tx: 'סוללת המשדר', day: 'יום 2', unknown: 'השעה לא דווחה' } : { overview: 'Overview', set: 'Infusion set', sensor: 'Sensor', calib: 'The pump asks for a calibration', tx: 'Transmitter battery', day: 'Day 2', unknown: 'Time not reported' };
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: he ? 'he-IL' : 'en-US', deviceScaleFactor: 2 });
      // Signed in already: on the web the app's own sign-in goes to the website (PM-593).
      const si = sessions['me@example.com'];
      const stored = { refreshToken: si.refresh_token, email: 'me@example.com', hasProfile: true, access: { token: si.access_token, until: Date.now() + 10 * 60000 } };
      await ctx.addInitScript(([st, lng]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('steady.session', JSON.stringify(st)); localStorage.setItem('steady.preferences', JSON.stringify({ locale: lng, takeBreak: false })); }, [stored, lang]);
      const p = await ctx.newPage(); lastPage = p; p.on('pageerror', (e) => errors.push(e.message)); p.setDefaultTimeout(6000);
      const visible = async (s) => (await p.getByText(s, { exact: false }).count()) > 0;
      await p.goto(base + '/'); await p.waitForTimeout(6000);
      if (await p.getByTestId('break-end').count()) { await p.getByTestId('break-end').click(); await p.goto(base + '/'); await p.waitForTimeout(5000); }
      await tab(p, T.overview); await p.waitForTimeout(3000);
      const open = async (title, name, checks) => {
        const row = p.getByRole('button', { name: new RegExp(`^${title}`) }).last();
        await row.scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
        if (name === 'sensor') await p.screenshot({ path: path.join(out, `${lang}-${scheme}-0-overview-rows.png`) });
        await row.click(); await p.waitForTimeout(2500);
        await p.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
        for (const c of checks) ok(`${lang} ${scheme} ${name} sheet shows "${c}"`, await visible(c));
        await p.goBack(); await p.waitForTimeout(1500);
      };
      await open(T.sensor, 'sensor', [T.calib, T.tx, '80%', 'CareLink']);
      await open(T.set, 'set', [T.day, T.unknown, '112.5']);
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
    if (lastPage) await lastPage.screenshot({ path: path.join(out, 'zz-failure.png') }).catch(() => null);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
