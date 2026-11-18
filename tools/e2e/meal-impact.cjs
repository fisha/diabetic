// Meal glucose curve (PM-239), fat and fiber (PM-243) and workout and sleep icons on the graph (PM-244), end-to-end
// against the test server (services/api: uvicorn tests.e2e_server:app on port 8000). Readings, a breakfast with fat and
// fiber, a walk and last night's sleep are put in the e2e database with psql, as a sync and the meal screen store them.
// Usage: PGURL=postgresql://steady:steady@localhost:5432/steady_e2e node tools/e2e/meal-impact.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database or one without c@example.com: it signs up c@example.com.
const http = require('http'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const PG = process.env.PGURL || 'postgresql://steady:steady@localhost:5432/steady_e2e';
const TZ = 'Asia/Jerusalem';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const sql = (q) => execFileSync('psql', [PG, '-tAc', q]).toString().trim();
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '70-180', target: '70-180' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };
const item = (name, carbs, protein, fat, fiber) => ({ name, qty: 1, unit: 'serving', carbs_g: carbs, protein_g: protein, fat_g: fat, fiber_g: fiber, prov: 'user', weighed: false, carbs_low_g: null, carbs_high_g: null, est_carbs_g: null, confidence: null });


const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'c@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'c@example.com', password: 'correct horse battery' } })).json.access_token;
    const uid = sql("select id from users where email = 'c@example.com'");
    sql(`update users set approved_at = now() where id = '${uid}'`);
    const docs = (await api('/consent', { token: tk })).json;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
    const now = Date.now();
    const local = new Date(new Date(now).toLocaleString('en-US', { timeZone: TZ }));
    const offset = local.getTime() - new Date(new Date(now).toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
    const midnight = Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()) - offset;
    if ((now - midnight) / 3_600_000 < 12) throw new Error('run after 12:00 Israel time: breakfast needs its three hours');
    // Sensor every 5 minutes. Flat at 110, a rise after breakfast at 08:00 to 170 at 09:00, back to 110 by 10:30.
    sql(`insert into glucose_records (id, user_id, idempotency_key, measured_at, entered_at, source, method, value, unit, value_mgdl, revision, hidden)
      select gen_random_uuid(), '${uid}', 'e2e-c-' || i, to_timestamp(${midnight / 1000} + i * 300), now(), 'carelink', 'sensor', v, 'mg/dL', v, 1, false
      from (select i, (case when i * 5 between 480 and 540 then 110 + (i * 5 - 480) when i * 5 between 540 and 630 then 170 - (i * 5 - 540) * 60 / 90.0 else 110 end)::float as v
            from generate_series(0, ${Math.floor(((now - midnight) / 300_000) - 1)}) i) s`);
    const at = (h, m = 0) => new Date(midnight + (h * 60 + m) * 60_000).toISOString();
    const rec = (key, kind, when, source, data) => `(gen_random_uuid(), '${uid}', '${key}', '${kind}', '${when}', '${when}', '${source}', '${JSON.stringify(data).replace(/'/g, "''")}', 1, false)`;
    const breakfast = { items: [item('Oatmeal', 30, 6, 4, 4), item('Greek yogurt', 6, 12, 8, 0)], ate: 'all', carbs_total_g: 36, protein_total_g: 18, fat_total_g: 12, fiber_total_g: 4, any_unknown: false };
    sql(`insert into records (id, user_id, idempotency_key, kind, occurred_at, entered_at, source, data, revision, hidden) values
      ${rec('e2e-breakfast', 'meal', at(8), 'app', breakfast)},
      ${rec('e2e-walk', 'activity', at(11), 'app', { type: 'walk', minutes: 40, intensity: 'm' })}`);
    // Last night from the watch: 23:10 to 06:20, woke once.
    const bed = midnight - 50 * 60_000; const wake = midnight + (6 * 60 + 20) * 60_000;
    const hs = (key, a, b, stage) => `(gen_random_uuid(), '${uid}', '${key}', 'apple_health', 'sleep', to_timestamp(${a / 1000}), to_timestamp(${b / 1000}), null, null, 'watch', '{"stage":"${stage}"}')`;
    sql(`insert into health_samples (id, user_id, idempotency_key, store, type, start_at, end_at, value, unit, origin, data) values
      ${hs('e2e-s1', bed, bed + 3 * 3_600_000, 'core')}, ${hs('e2e-s2', bed + 3 * 3_600_000, bed + 3.1 * 3_600_000, 'awake')}, ${hs('e2e-s3', bed + 3.1 * 3_600_000, wake, 'deep')}`);
    const runs = process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']];
    for (const [lang, scheme] of runs) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', timezoneId: TZ, deviceScaleFactor: 2, permissions: ['camera'] });
      const page = await ctx.newPage(); global.lastPage = page;
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      const he = lang === 'he';
      const L = he
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', meal: /^ארוחה ב־08:00/, walk: /^אימון ב־11:00/, sleep: /^שינה, .*הצגת פרטים$/, curve: 'הגלוקוז אחרי הארוחה', macros: 'חלבון ≈ 18 גרם · שומן ≈ 12 גרם · סיבים ≈ 4 גרם', rise: 'עלייה', close: 'סגירה', tab: 'סקירה', open: 'פתיחה ביומן', fat: 'שומן', asleep: /שינה בפועל/, workout: 'אימון', week: 'שבוע', rises: 'העליות הגדולות השבוע', back: 'חזר להתחלה 1:30 ש׳ אחרי השיא', scan: 'סריקת ברקוד', aim: 'כוונו אל הברקוד', src: /Open Food Facts/ }
        : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', meal: /^Meal at 08:00/, walk: /^Workout at 11:00/, sleep: /^Sleep, .*Show details$/, curve: 'Glucose after this meal', macros: 'Protein ≈ 18 g · Fat ≈ 12 g · Fiber ≈ 4 g', rise: 'Rise', close: 'Close', tab: 'Overview', open: 'Open in journal', fat: 'Fat', asleep: /Asleep/, workout: 'Workout', week: 'Week', rises: 'Biggest rises this week', back: 'Back at start 1h 30m after the highest', scan: 'Scan a barcode', aim: 'Point at the barcode', src: /Open Food Facts/ };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('c@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await page.getByRole('tab', { name: L.tab, exact: true }).click(); await page.waitForTimeout(3000);
      const meal = page.getByRole('button', { name: L.meal });
      await meal.scrollIntoViewIfNeeded(); await page.waitForTimeout(1500);
      await shot('01-graph-icons');
      ok(`${lang}-${scheme} workout and sleep icons can be tapped`, (await page.getByRole('button', { name: L.walk }).isVisible()) && (await page.getByRole('button', { name: L.sleep }).isVisible()));
      await meal.click(); await page.waitForTimeout(2500);
      await shot('02-meal-sheet');
      ok(`${lang}-${scheme} meal sheet shows protein, fat and fiber`, await page.getByText(L.macros).isVisible());
      ok(`${lang}-${scheme} meal sheet shows the glucose curve`, (await page.getByText(L.curve).isVisible()) && (await page.getByText(L.rise, { exact: true }).isVisible()));
      ok(`${lang}-${scheme} curve: 110 at the meal, highest 170 after 1:00, +60, back after 2:30`, (await page.getByText(/110 mg\/dL/).first().isVisible()) && (await page.getByText(/170 mg\/dL/).first().isVisible()) && (await page.getByText(/\+60 mg\/dL/).isVisible()));
      await page.getByText(L.curve).scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
      await shot('03-meal-curve');
      await page.getByRole('button', { name: L.open }).first().click(); await page.waitForTimeout(2500);
      await page.getByText(L.curve).scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(500);
      await shot('04-journal-entry');
      ok(`${lang}-${scheme} journal entry shows the curve and fat`, (await page.getByText(L.curve).isVisible()) && (await page.getByText(L.fat, { exact: true }).isVisible()));
      await page.getByRole('tab', { name: L.tab, exact: true }).click(); await page.waitForTimeout(2500);
      await page.getByRole('button', { name: L.walk }).click(); await page.waitForTimeout(1500);
      await shot('05-workout-sheet');
      ok(`${lang}-${scheme} workout sheet`, await page.getByText(L.workout, { exact: true }).first().isVisible());
      await page.getByRole('button', { name: L.close, exact: true }).last().click(); await page.waitForTimeout(800);
      await page.getByRole('button', { name: L.sleep }).click(); await page.waitForTimeout(1500);
      await shot('06-sleep-sheet');
      ok(`${lang}-${scheme} sleep sheet shows 23:10 – 06:20 and time asleep`, (await page.getByText(/23:10/).first().isVisible()) && (await page.getByText(L.asleep).first().isVisible()));
      await page.getByRole('button', { name: L.close, exact: true }).last().click(); await page.waitForTimeout(800);
      await page.getByRole('radio', { name: L.week, exact: true }).first().click(); await page.waitForTimeout(3500);
      const rises = page.getByText(L.rises, { exact: true });
      await rises.scrollIntoViewIfNeeded(); await page.waitForTimeout(800);
      await shot('07-week-rises');
      ok(`${lang}-${scheme} week lists breakfast's rise, 110 → 170, and not the walk (no rise)`, (await page.getByText('110 → 170').isVisible()) && (await page.getByText('Oatmeal, Greek yogurt').first().isVisible()));
      // How quickly it came back (PM-253): on the row, and a tap opens the curve.
      ok(`${lang}-${scheme} the rise says it was back at start 1:30 after the highest`, await page.getByText(L.back, { exact: true }).isVisible());
      await page.getByText(L.back, { exact: true }).click(); await page.waitForTimeout(2500);
      await shot('07b-rise-curve');
      ok(`${lang}-${scheme} tapping the rise opens its curve`, (await page.getByText(L.curve).last().isVisible()) && (await page.getByRole('button', { name: L.open }).first().isVisible()));
      await page.getByRole('button', { name: L.close, exact: true }).last().click(); await page.waitForTimeout(800);
      // Barcode scan (PM-242): the entry on Log a meal and the scan screen with the (fake) camera.
      await page.goto(base + '/meal'); await page.getByRole('button', { name: L.scan }).waitFor({ timeout: 15000 }); await page.waitForTimeout(5000);
      await page.getByRole('button', { name: L.scan }).scrollIntoViewIfNeeded(); await shot('08-log-meal');
      ok(`${lang}-${scheme} Log a meal offers a barcode scan`, await page.getByRole('button', { name: L.scan }).isVisible());
      await page.getByRole('button', { name: L.scan }).click(); await page.waitForTimeout(3000);
      await shot('09-barcode-scan');
      ok(`${lang}-${scheme} scan screen with the Open Food Facts source`, (await page.getByText(L.aim).isVisible()) && (await page.getByText(L.src).isVisible()));
      await ctx.close();
    }
  } catch (e) {
    ok('run', false, e.message.split('\n')[0]);
    if (global.lastPage) await global.lastPage.screenshot({ path: path.join(out, 'failed.png') }).catch(() => {});
  } finally {
    ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    console.log(results.join('\n'));
    await browser.close(); server.close();
    process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
  }
});
