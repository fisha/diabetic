// Options inside the Journal's filter tabs (Guy, 21 Nov 2026, PM-372): a long press on Glucose, Insulin, Meals, Alerts
// or All opens them; a "Filtered" line with Clear shows while one is on, and the tab carries its choice. End-to-end
// against the test server (services/api: uvicorn tests.e2e_server:app on port 8000). Synthetic pump readings, insulin,
// meals and pump alerts are put in the e2e database with psql, as the syncs store them.
// Usage: PGURL=postgresql://steady:steady@localhost:5432/steady_e2e node tools/e2e/journal-filters.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up jf@example.com.
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
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Stedio', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8091, async () => {
  const base = 'http://localhost:8091';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'jf@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'jf@example.com', password: 'correct horse battery' } })).json.access_token;
    const uid = sql("select id from users where email = 'jf@example.com'");
    sql(`update users set approved_at = now() where id = '${uid}'`);
    const docs = (await api('/consent', { token: tk })).json;
    if (docs && docs.documents) await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    // Everything inside today, so the two-hour blocks are today's: anchored at local noon.
    const noon = new Date(); noon.setHours(12, 0, 0, 0);
    const at = (m) => new Date(noon.getTime() - m * 60_000).toISOString();
    // Pump readings every 5 minutes from 06:00 to 12:00.
    const vals = [];
    for (let m = 360, i = 0; m >= 0; m -= 5, i++) vals.push(`(gen_random_uuid(), '${uid}', 'jf-g${i}', '${at(m)}', '${at(m)}', 'carelink', 'sensor', ${110 + (i % 9) * 4}, 'mg/dL', ${110 + (i % 9) * 4}, 1, false)`);
    sql(`insert into glucose_records (id, user_id, idempotency_key, measured_at, entered_at, source, method, value, unit, value_mgdl, revision, hidden) values ${vals.join(',')}`);
    const rec = (key, kind, m, source, data) => `(gen_random_uuid(), '${uid}', '${key}', '${kind}', '${at(m)}', '${at(m)}', '${source}', '${JSON.stringify(data)}', 1, false)`;
    const meal = (g, name) => ({ items: [{ name, grams: 100, carbs_g: g, prov: 'db' }], ate: 'all', carbs_total_g: g, any_unknown: false });
    sql(`insert into records (id, user_id, idempotency_key, kind, occurred_at, entered_at, source, data, revision, hidden) values
      ${rec('jf-basal', 'insulin', 340, 'app', { insulin: 'Tresiba', units: 14, reason: 'basal' })},
      ${rec('jf-bolus', 'insulin', 101, 'carelink', { insulin: 'Pump', units: 2.4, reason: 'pump bolus' })},
      ${rec('jf-pen', 'insulin', 30, 'app', { insulin: 'NovoRapid', units: 3, reason: 'meal' })},
      ${rec('jf-auto', 'insulin', 55, 'carelink', { insulin: 'Pump', units: 0.2, reason: 'auto correction' })},
      ${rec('jf-small', 'meal', 240, 'app', meal(20, 'Apple'))},
      ${rec('jf-edge', 'meal', 180, 'app', meal(30, 'Yogurt'))},
      ${rec('jf-large', 'meal', 32, 'app', meal(65, 'Pasta'))}`);
    const ev = (key, m, code) => `(gen_random_uuid(), '${uid}', '${key}', 'carelink', '${at(m)}', 'alert', '${code}')`;
    sql(`insert into device_events (id, user_id, idempotency_key, source, occurred_at, kind, code) values
      ${ev('jf-low', 300, '787')}, ${ev('jf-high', 200, '816')}, ${ev('jf-set', 150, '109')}, ${ev('jf-sensor', 120, '777')}`);

    const runs = process.env.ONLY ? [process.env.ONLY.split(':')] : [['he', 'dark'], ['en', 'light'], ['he', 'light']];
    for (const [lang, scheme] of runs) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage(); global.lastPage = page;
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      const he = lang === 'he';
      const L = he
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', tab: 'יומן', all: 'הכול', glu: 'גלוקוז', ins: 'אינסולין', meal: 'ארוחות', alert: 'התראות', every2h: 'כל שעתיים', auto: 'תיקון אוטומטי', autoT: 'תיקון אוטומטי של המשאבה', bolus: 'בולוס', small: 'קטנות, עד 30 גרם', large: 'גדולות, מעל 30 גרם', low: 'נמוך', set: 'החלפת סט', clear: 'נקה', done: 'סיום', filtered: 'מסונן', lowT: 'סוכר נמוך', highT: 'סוכר גבוה', g20: 'ארוחה ≈ 20', g30: 'ארוחה ≈ 30', g65: 'ארוחה ≈ 65' }
        : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', tab: 'Journal', all: 'All', glu: 'Glucose', ins: 'Insulin', meal: 'Meals', alert: 'Alerts', every2h: 'Every 2 hours', auto: 'Auto correction', autoT: 'Automatic correction by the pump', bolus: 'Bolus', small: 'Small, up to 30 g', large: 'Large, over 30 g', low: 'Low', set: 'Set change', clear: 'Clear', done: 'Done', filtered: 'Filtered', lowT: 'Low glucose', highT: 'High glucose', g20: 'Meal ≈ 20', g30: 'Meal ≈ 30', g65: 'Meal ≈ 65' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('jf@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await page.getByRole('tab', { name: L.tab, exact: true }).click(); await page.waitForTimeout(3000);
      const tab = (name) => page.getByRole('tab', { name: new RegExp(`^${name}`) }).first();
      const longPress = async (name) => {
        await tab(name).scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
        const b = await tab(name).boundingBox();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(900); await page.mouse.up();
        await page.waitForTimeout(900);
      };
      const choose = async (label) => { await page.getByRole('radio', { name: label, exact: true }).click(); await page.waitForTimeout(400); };
      const closeSheet = async () => { await page.getByRole('button', { name: L.done, exact: true }).click(); await page.waitForTimeout(900); };
      const count = (re) => page.getByText(re).count();
      const seen = async (text) => (await page.getByText(text, { exact: false }).count()) > 0;
      await shot('01-journal');
      // The rows say the kind of entry only, never the source's name (Guy, 21 Nov 2026, PM-376).
      ok(`${lang}-${scheme} no source name on the rows`, (await page.getByText(/CareLink/).filter({ visible: true }).count()) === 0);

      // Glucose: every two hours keeps one reading per block; Clear brings them all back.
      await tab(L.glu).click(); await page.waitForTimeout(800);
      // The count includes the main screen's latest reading, which stays mounted behind the journal: 4 blocks + 1.
      const allReadings = await count(/mg\/dL/);
      await longPress(L.glu);
      await shot('02-glucose-sheet');
      await choose(L.every2h); await closeSheet();
      const fewer = await count(/mg\/dL/);
      ok(`${lang}-${scheme} every 2 hours: one reading per block`, fewer > 0 && fewer <= 5 && fewer < allReadings, `${allReadings} -> ${fewer}`);
      ok(`${lang}-${scheme} tab shows the choice`, await tab(`${L.glu} · ${L.every2h}`).isVisible());
      ok(`${lang}-${scheme} filtered line with Clear`, (await seen(L.filtered)) && (await page.getByRole('button', { name: L.clear, exact: true }).isVisible()));
      await shot('03-glucose-every2h');
      await page.getByRole('button', { name: L.clear, exact: true }).click(); await page.waitForTimeout(800);
      ok(`${lang}-${scheme} Clear brings every reading back`, (await count(/mg\/dL/)) === allReadings && !(await seen(L.filtered)));

      // Insulin (PM-375): the pump's automatic corrections, or the boluses the person gave; basal is neither.
      await longPress(L.ins);
      await choose(L.auto); await closeSheet();
      ok(`${lang}-${scheme} auto correction shows only the pump's correction`, (await seen(L.autoT)) && !(await seen('NovoRapid')) && !(await seen('Tresiba')));
      await shot('04-insulin-auto');
      await longPress(L.ins); await choose(L.bolus); await closeSheet();
      ok(`${lang}-${scheme} bolus: own boluses, no auto correction, no basal`, (await seen('NovoRapid')) && !(await seen(L.autoT)) && !(await seen('Tresiba')));
      await shot('04b-insulin-bolus');

      // Meals: 30 g is small, 65 g is large.
      await longPress(L.meal); await choose(L.small); await closeSheet();
      ok(`${lang}-${scheme} small meals: 20 and 30 g`, (await seen(L.g20)) && (await seen(L.g30)) && !(await seen(L.g65)));
      await shot('05-meals-small');

      // Alerts: low only.
      await longPress(L.alert); await choose(L.low); await closeSheet();
      ok(`${lang}-${scheme} low alerts only`, (await seen(L.lowT)) && !(await seen(L.highT)));
      await shot('06-alerts-low');

      // All: every kind's options, and the choices made on the tabs held there.
      await longPress(L.all);
      ok(`${lang}-${scheme} All offers every kind`, (await page.getByRole('radiogroup').count()) === 4);
      await shot('07-all-sheet');
      ok(`${lang}-${scheme} All with Bolus shows no auto correction`, !(await seen(L.autoT)));
      await closeSheet();
      ok(`${lang}-${scheme} All tab counts three choices`, await tab(`${L.all} · 3`).isVisible());
      await shot('08-all-filtered');
      await page.getByRole('button', { name: L.clear, exact: true }).click(); await page.waitForTimeout(800);
      ok(`${lang}-${scheme} Clear on All clears every choice`, (await tab(L.ins).textContent()).trim() === L.ins && !(await seen(L.filtered)));
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
