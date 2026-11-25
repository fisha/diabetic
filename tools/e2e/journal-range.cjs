// The Journal's days (Guy, 25 Nov 2026, PM-520): the last 7 days by default, and dates picked on the All filter's
// options for older entries. The range holds on every tab, shows on the "Filtered" line, and Clear goes back to 7 days.
// A week of pump readings every 5 minutes is drawn day by day. End-to-end against the test server (services/api:
// uvicorn tests.e2e_server:app on port 8000); synthetic readings and meals are put in the e2e database with psql.
// Usage: PGURL=postgresql://steady:steady@localhost:5432/steady_e2e node tools/e2e/journal-range.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from a database without jr@example.com.
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
    await api('/auth/sign-up', { method: 'POST', body: { email: 'jr@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'jr@example.com', password: 'correct horse battery' } })).json.access_token;
    const uid = sql("select id from users where email = 'jr@example.com'");
    sql(`update users set approved_at = now() where id = '${uid}'`);
    const docs = (await api('/consent', { token: tk })).json;
    if (docs && docs.documents) await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    // Local days back from today, at 08:00 (today at 00:30, so it is never in the future).
    const day = (n, h = 8) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); d.setHours(h, n === 0 ? 30 : 0); return d; };
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // Pump readings every 5 minutes for the whole last week, up to now.
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6);
    const vals = [];
    for (let t = start.getTime(), i = 0; t < Date.now() - 60_000; t += 5 * 60_000, i++) {
      const iso = new Date(t).toISOString();
      vals.push(`(gen_random_uuid(), '${uid}', 'jr-g${i}', '${iso}', '${iso}', 'carelink', 'sensor', ${110 + (i % 9) * 4}, 'mg/dL', ${110 + (i % 9) * 4}, 1, false)`);
    }
    for (let k = 0; k < vals.length; k += 500) sql(`insert into glucose_records (id, user_id, idempotency_key, measured_at, entered_at, source, method, value, unit, value_mgdl, revision, hidden) values ${vals.slice(k, k + 500).join(',')}`);
    const meal = (g, name) => ({ items: [{ name, grams: 100, carbs_g: g, prov: 'db' }], ate: 'all', carbs_total_g: g, any_unknown: false });
    const rec = (key, d, g) => `(gen_random_uuid(), '${uid}', '${key}', 'meal', '${d.toISOString()}', '${d.toISOString()}', 'app', '${JSON.stringify(meal(g, 'Bread'))}', 1, false)`;
    // 11 g today, 22 g three days ago, 33 g six days ago (all in the week), 44 g ten days ago, 55 g forty days ago.
    const MEALS = [[0, 11], [3, 22], [6, 33], [10, 44], [40, 55]];
    sql(`insert into records (id, user_id, idempotency_key, kind, occurred_at, entered_at, source, data, revision, hidden) values ${MEALS.map(([n, g]) => rec(`jr-m${n}`, day(n), g)).join(',')}`);

    const runs = process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'dark']];
    for (const [lang, scheme] of runs) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage(); global.lastPage = page;
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(8000);
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      const he = lang === 'he';
      const L = he
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', tab: 'יומן', all: 'הכול', meal: 'ארוחות', week: '7 הימים האחרונים', pick: 'בחירת תאריכים', from: 'מתאריך', to: 'עד תאריך', clear: 'נקה', done: 'סיום', filtered: 'מסונן', m: (g) => `ארוחה ≈ ${g}` }
        : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', tab: 'Journal', all: 'All', meal: 'Meals', week: 'Last 7 days', pick: 'Choose dates', from: 'From', to: 'To', clear: 'Clear', done: 'Done', filtered: 'Filtered', m: (g) => `Meal ≈ ${g}` };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('jr@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      const t0 = Date.now();
      await page.getByRole('tab', { name: L.tab, exact: true }).click();
      await page.getByText(L.m(11)).first().waitFor();
      const opened = Date.now() - t0;
      await page.waitForTimeout(1500);
      const tab = (name) => page.getByRole('tab', { name: new RegExp(`^${name}`) }).first();
      const seen = async (text) => (await page.getByText(text, { exact: false }).count()) > 0;
      const longPress = async (name) => {
        const b = await tab(name).boundingBox();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(900); await page.mouse.up();
        await page.waitForTimeout(900);
      };
      const closeSheet = async () => { await page.getByRole('button', { name: L.done, exact: true }).click(); await page.waitForTimeout(1500); };
      // Only the first days are drawn at first: far fewer reading rows than the week holds.
      const rows = await page.getByText(/mg\/dL/).count();
      ok(`${lang}-${scheme} journal opens on a week of readings`, opened < 8000, `${opened} ms, ${rows} of ${vals.length} reading rows drawn`);
      ok(`${lang}-${scheme} days are drawn as they scroll`, rows < vals.length / 2, `${rows} rows`);
      await shot('01-week');
      // Meals tab: the week's three meals, not the one ten days ago.
      await tab(L.meal).click(); await page.waitForTimeout(1000);
      ok(`${lang}-${scheme} the last 7 days by default`, (await seen(L.m(11))) && (await seen(L.m(22))) && (await seen(L.m(33))) && !(await seen(L.m(44))));
      await shot('02-week-meals');
      // All's options: the dates first.
      await tab(L.all).click(); await page.waitForTimeout(600);
      await longPress(L.all);
      ok(`${lang}-${scheme} All offers the dates`, (await page.getByRole('radio', { name: L.week, exact: true }).isVisible()) && (await page.getByRole('radio', { name: L.pick, exact: true }).isVisible()));
      await shot('03-all-sheet');
      await page.getByRole('radio', { name: L.pick, exact: true }).click(); await page.waitForTimeout(800);
      ok(`${lang}-${scheme} From and To fields`, (await page.getByRole('button', { name: new RegExp(`^${L.from},`) }).isVisible()) && (await page.getByRole('button', { name: new RegExp(`^${L.to},`) }).isVisible()));
      await shot('04-pick-dates');
      await closeSheet();
      // The week before: the meal ten days ago, not today's.
      await tab(L.meal).click(); await page.waitForTimeout(1500);
      ok(`${lang}-${scheme} the week before`, (await seen(L.m(44))) && !(await seen(L.m(11))) && !(await seen(L.m(33))));
      ok(`${lang}-${scheme} picked dates on the line on every tab`, (await seen(L.filtered)) && (await page.getByRole('button', { name: L.clear, exact: true }).isVisible()));
      await shot('05-before-week-meals');
      // From forty-five days ago: the meal forty days ago comes in.
      await tab(L.all).click(); await page.waitForTimeout(600);
      ok(`${lang}-${scheme} All counts the dates`, await tab(`${L.all} · 1`).isVisible());
      await longPress(L.all);
      await page.getByRole('button', { name: new RegExp(`^${L.from},`) }).click(); await page.waitForTimeout(400);
      await page.locator(`input[type=date][aria-label="${L.from}"]`).fill(ymd(day(45))); await page.waitForTimeout(600);
      await closeSheet();
      await page.waitForTimeout(1500);
      await tab(L.meal).click(); await page.waitForTimeout(1200);
      ok(`${lang}-${scheme} an older From brings older meals`, (await seen(L.m(55))) && (await seen(L.m(44))));
      await shot('06-older-meals');
      // Clear: back to the last 7 days.
      await page.getByRole('button', { name: L.clear, exact: true }).click(); await page.waitForTimeout(2000);
      ok(`${lang}-${scheme} Clear goes back to the last 7 days`, (await seen(L.m(11))) && !(await seen(L.m(44))) && !(await seen(L.filtered)));
      await page.goto(base); await page.waitForTimeout(1000);
      await ctx.close();
    }
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); if (global.lastPage) await global.lastPage.screenshot({ path: path.join(out, 'zz-fail.png') });
  }
  console.log(results.join('\n'));
  console.log(errors.length ? 'page errors:\n' + [...new Set(errors)].join('\n') : 'no page errors');
  const failed = results.some((r) => !r.startsWith('PASS'));
  await browser.close(); server.close();
  process.exitCode = failed ? 1 : 0;
});
