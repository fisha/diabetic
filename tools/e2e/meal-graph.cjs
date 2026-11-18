// Tap a meal icon on the Overview glucose graph to see what was eaten (Guy, 18 Nov 2026, PM-224), end-to-end against
// the test server (services/api: uvicorn tests.e2e_server:app on port 8000). Readings and records are put in the e2e
// database with psql, as a sync and the meal screen would store them: a meal logged in the app with its pump bolus, a
// second meal ten minutes later (their icons overlap), and carbs entered on the pump with their bolus.
// Usage: PGURL=postgresql://steady:steady@localhost:5432/steady_e2e node tools/e2e/meal-graph.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up g@example.com.
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
const item = (name, carbs, protein) => ({ name, qty: 1, unit: 'serving', carbs_g: carbs, protein_g: protein, prov: 'user', weighed: false, carbs_low_g: null, carbs_high_g: null, est_carbs_g: null, fat_g: null, confidence: null });

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'g@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'g@example.com', password: 'correct horse battery' } })).json.access_token;
    const uid = sql("select id from users where email = 'g@example.com'");
    sql(`update users set approved_at = now() where id = '${uid}'`);
    const docs = (await api('/consent', { token: tk })).json;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
    // Today in Israel: sensor readings every 5 minutes from midnight until now.
    const now = Date.now();
    const local = new Date(new Date(now).toLocaleString('en-US', { timeZone: TZ }));
    const offset = local.getTime() - new Date(new Date(now).toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
    const midnight = Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()) - offset;
    const hoursSince = (now - midnight) / 3_600_000;
    if (hoursSince < 7) throw new Error('run after 07:00 Israel time: the meals are placed in the morning');
    sql(`insert into glucose_records (id, user_id, idempotency_key, measured_at, entered_at, source, method, value, unit, value_mgdl, revision, hidden)
      select gen_random_uuid(), '${uid}', 'e2e-g-' || i, to_timestamp(${midnight / 1000} + i * 300), now(), 'carelink', 'sensor', v, 'mg/dL', v, 1, false
      from (select i, round(120 + 30 * sin(i / 12.0))::float as v from generate_series(0, ${Math.floor(((now - midnight) / 300_000) - 1)}) i) s`);
    const at = (h, m = 0) => new Date(midnight + (h * 60 + m) * 60_000).toISOString();
    const rec = (key, kind, when, source, data) => `(gen_random_uuid(), '${uid}', '${key}', '${kind}', '${when}', '${when}', '${source}', '${JSON.stringify(data).replace(/'/g, "''")}', 1, false)`;
    const breakfast = { items: [item('Oatmeal', 30, 6), item('Greek yogurt', 6, 12)], ate: 'all', carbs_total_g: 36, protein_total_g: 18, any_unknown: false };
    const coffee = { items: [item('Latte', 10, 6)], ate: 'all', carbs_total_g: 10, protein_total_g: 6, any_unknown: false };
    const pumpMeal = { items: [], ate: 'all', carbs_total_g: 45, any_unknown: false, note: 'Pasta with tomato sauce' };
    sql(`insert into records (id, user_id, idempotency_key, kind, occurred_at, entered_at, source, data, revision, hidden) values
      ${rec('e2e-breakfast', 'meal', at(7, 30), 'app', breakfast)},
      ${rec('e2e-bolus-1', 'insulin', at(7, 32), 'carelink', { insulin: 'Pump', units: 3.6, reason: 'pump bolus' })},
      ${rec('e2e-coffee', 'meal', at(7, 40), 'app', coffee)},
      ${rec('e2e-pump-meal', 'meal', at(5, 0), 'carelink', pumpMeal)},
      ${rec('e2e-bolus-2', 'insulin', at(5, 0), 'carelink', { insulin: 'Pump', units: 4.5, reason: 'pump bolus' })}`);

    const runs = process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']];
    for (const [lang, scheme] of runs) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', timezoneId: TZ, deviceScaleFactor: 2 });
      const page = await ctx.newPage(); global.lastPage = page;
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      const he = lang === 'he';
      const L = he
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', one: /^ארוחה ב־05:00/, two: /^2 ארוחות, 07:30 עד 07:40/, t1: 'ארוחה', t2: '2 ארוחות', open: 'פתיחה ביומן', protein: 'חלבון ≈ 18 גרם', close: 'סגירה', tab: 'סקירה', field: 'מה אכלת?', back: 'חזרה ליומן' }
        : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', one: /^Meal at 05:00/, two: /^2 meals, 07:30 to 07:40/, t1: 'Meal', t2: '2 meals', open: 'Open in journal', protein: 'Protein ≈ 18 g', close: 'Close', tab: 'Overview', field: 'What did you eat?', back: 'Back to journal' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('g@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await page.getByRole('tab', { name: L.tab, exact: true }).click(); await page.waitForTimeout(3000);
      const graph = page.getByRole('button', { name: L.two });
      await graph.scrollIntoViewIfNeeded(); await page.waitForTimeout(1500);
      await shot('01-graph');
      const box = await graph.boundingBox();
      ok(`${lang}-${scheme} overlapping meals share one tap area (44 tall, the space to the next meal split)`, box && box.width >= 36 && box.height >= 44, JSON.stringify(box));
      ok(`${lang}-${scheme} the pump meal has its own tap area`, await page.getByRole('button', { name: L.one }).isVisible());
      await graph.click(); await page.waitForTimeout(1200);
      await shot('02-two-meals');
      ok(`${lang}-${scheme} sheet lists both meals`, await page.getByText(L.t2, { exact: true }).isVisible() && (await page.getByText('Oatmeal, Greek yogurt').isVisible()) && (await page.getByText('Latte').first().isVisible()));
      ok(`${lang}-${scheme} breakfast shows its protein and its pump bolus in the same row`, (await page.getByText(L.protein).isVisible()) && (await page.getByText(/3\.6/).first().isVisible()));
      await page.getByRole('button', { name: L.close, exact: true }).last().click(); await page.waitForTimeout(800);
      await page.getByRole('button', { name: L.one }).click(); await page.waitForTimeout(1200);
      await shot('03-pump-meal');
      ok(`${lang}-${scheme} pump meal shows the note and the bolus`, (await page.getByText('Pasta with tomato sauce').first().isVisible()) && (await page.getByText(/4\.5/).first().isVisible()));
      await page.getByRole('button', { name: L.open }).first().click(); await page.waitForTimeout(2500);
      await shot('04-journal-entry');
      const note = page.getByLabel(L.field, { exact: true });
      ok(`${lang}-${scheme} journal opens that meal's own entry`, (await note.isVisible()) && (await note.inputValue()) === 'Pasta with tomato sauce');
      await page.getByRole('button', { name: L.back }).first().click(); await page.waitForTimeout(1200);
      await shot('05-journal-list');
      ok(`${lang}-${scheme} back from it shows the journal list`, await page.getByText('Pasta with tomato sauce').first().isVisible());
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
