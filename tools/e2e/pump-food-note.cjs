// "What did you eat?" on carbs entered on the pump (Guy, 16 Nov 2026), end-to-end against the test server
// (services/api: uvicorn tests.e2e_server:app on port 8000). The pump's meal and bolus are put in the e2e database with psql,
// as a CareLink sync would store them.
// Usage: PGURL=postgresql://steady:steady@localhost:5432/steady_e2e node tools/e2e/pump-food-note.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up p@example.com.
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
    await api('/auth/sign-up', { method: 'POST', body: { email: 'p@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'p@example.com', password: 'correct horse battery' } })).json.access_token;
    const uid = sql("select id from users where email = 'p@example.com'");
    sql(`update users set approved_at = now() where id = '${uid}'`);
    const at = new Date(Date.now() - 40 * 60_000).toISOString();
    const meal = JSON.stringify({ items: [], ate: 'all', carbs_total_g: 45, any_unknown: false });
    const bolus = JSON.stringify({ insulin: 'Pump', units: 3.5, reason: 'pump bolus' });
    sql(`insert into records (id, user_id, idempotency_key, kind, occurred_at, entered_at, source, data, revision, hidden) values
      (gen_random_uuid(), '${uid}', 'cl-e2e-meal', 'meal', '${at}', '${at}', 'carelink', '${meal}', 1, false),
      (gen_random_uuid(), '${uid}', 'cl-e2e-bolus', 'insulin', '${at}', '${at}', 'carelink', '${bolus}', 1, false)`);
    const mealId = sql("select id from records where idempotency_key = 'cl-e2e-meal'");

    const runs = process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']];
    for (const [lang, scheme] of runs) {
      await api(`/records/${mealId}/food-note`, { method: 'PUT', token: tk, body: { text: null } });
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage(); global.lastPage = page;
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      const he = lang === 'he';
      const L = he
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', tab: 'יומן', meal: 'ארוחה ≈ 45 ג׳ פחמימות', field: 'מה אכלת?', saved: 'נשמר', food: 'פסטה ברוטב עגבניות' }
        : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', tab: 'Journal', meal: 'Meal ≈ 45 g carbs', field: 'What did you eat?', saved: 'Saved', food: 'Pasta with tomato sauce' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('p@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await page.getByRole('tab', { name: L.tab, exact: true }).click(); await page.waitForTimeout(2500);
      await shot('01-journal-before');
      // The pump's meal sits in its bolus row; open the row, then the meal part.
      await page.getByText(L.meal).first().click(); await page.waitForTimeout(1000);
      if (!(await page.getByLabel(L.field, { exact: true }).isVisible().catch(() => false))) {
        await page.getByRole('button', { name: new RegExp(L.meal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click(); await page.waitForTimeout(1000);
      }
      await shot('02-meal-empty');
      const field = page.getByLabel(L.field, { exact: true });
      ok(`${lang}-${scheme} field shown`, await field.isVisible());
      await field.fill(L.food); await page.waitForTimeout(2000);
      ok(`${lang}-${scheme} saved hint`, await page.getByText(L.saved, { exact: true }).first().isVisible());
      await shot('03-meal-noted');
      const rec = (await api(`/records/${mealId}`, { token: tk })).json;
      ok(`${lang}-${scheme} note stored, pump values kept`, rec.data.note === L.food && rec.data.carbs_total_g === 45 && rec.revision === 1 && rec.source === 'carelink', JSON.stringify(rec.data));
      await page.goto(base); await page.waitForTimeout(1000);
      await ctx.close();
    }
    // The list row shows the note (one more pass, English light, already noted).
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await api(`/records/${mealId}/food-note`, { method: 'PUT', token: tk, body: { text: 'Pasta with tomato sauce' } });
    await api('/profile', { method: 'PUT', token: tk, body: { locale: 'he', answers: ANSWERS } });
    await page.goto(base); await page.waitForTimeout(2000);
    await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800);
    await page.getByText('כבר יש לי חשבון', { exact: true }).last().click(); await page.waitForTimeout(1500);
    await page.getByLabel('אימייל', { exact: true }).fill('p@example.com');
    await page.getByLabel('סיסמה', { exact: true }).fill('correct horse battery');
    await page.getByText('כניסה', { exact: true }).last().click(); await page.waitForTimeout(4000);
    await page.getByRole('tab', { name: 'יומן', exact: true }).click(); await page.waitForTimeout(2500);
    await page.getByText('ארוחה ≈ 45 ג׳ פחמימות').first().click(); await page.waitForTimeout(1000);
    ok('note shown in the row detail', await page.getByText('Pasta with tomato sauce').first().isVisible());
    await page.screenshot({ path: path.join(out, 'he-light-04-row-with-note.png') });
    await ctx.close();
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
