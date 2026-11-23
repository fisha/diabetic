// Food today > "Meals today" (Guy, 23 Nov 2026, PM-442: "Empty when clicking on Food Today -> Meals today"): the sheet
// lists today's meals; while it reads it shows a spinner, never a blank sheet; a read that fails says so with a retry
// instead of "No meals logged today yet", and the retry brings the meals. End-to-end against the test server
// (services/api: uvicorn tests.e2e_server:app; env STEADY_ALLOW_EMAIL_SIGN_UP=true STEADY_REQUIRE_EMAIL_VERIFICATION=false
// STEADY_REQUIRE_APPROVAL=false STEADY_CORS_ORIGINS='["http://localhost:8090"]').
// Usage: node tools/e2e/meals-today-sheet.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up mt@example.com. The phone's zone is Asia/Jerusalem.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000'; const TZ = 'Asia/Jerusalem';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '80-140' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm', classic: true }, checkIns: { frequency: 'moreAtFirst' } };
// The local midnight of now in the phone's zone.
const localMidnight = () => {
  const now = Date.now();
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
  const v = (t) => Number(parts.find((p) => p.type === t).value);
  return now - ((v('hour') * 60 + v('minute')) * 60 + v('second')) * 1000;
};

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'mt@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'mt@example.com', password: 'correct horse battery' } })).json.access_token;
    const docs = (await api('/consent', { token: tk })).json;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    await api('/profile', { method: 'PUT', token: tk, body: { locale: 'en', answers: ANSWERS } });
    await api('/settings', { method: 'PATCH', token: tk, body: { timezone: TZ } });
    const now = Date.now(); const H = 3_600_000; const mid = localMidnight();
    // Two meals since this morning's midnight, as Guy's two.
    const since = (now - mid) / H;
    const meals = [[since * 0.3, 'Tuna wrap', 10, 40], [since * 0.6, 'Eggs', 6, 41]];
    let i = 0;
    for (const [h, name, carbs, protein] of meals) {
      const items = [{ name, unit: 'g', qty: 100, carbs_g: carbs, protein_g: protein, prov: 'wt', weighed: true }];
      const r = await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `mt-meal-${i++}`, kind: 'meal', occurred_at: new Date(now - h * H).toISOString(), entered_at: new Date().toISOString(), source: 'manual', data: { items, ate: 'all', carbs_total_g: carbs, protein_total_g: protein, any_unknown: false } } });
      ok(`meal ${name} saved`, r.status < 300, String(r.status));
    }
    // Two days of sensor readings, so the Overview shows its periods.
    const g = []; for (let t = now - 2 * 86400000, k = 0; t < now - 180000; t += 5 * 60000, k++) g.push({ sample_id: `e2e-mt-glucose-${String(k).padStart(6, '0')}`, measured_at: new Date(t).toISOString(), value: 110 + ((k * 13) % 50), unit: 'mg/dL', method: 'sensor' });
    for (let k = 0; k < g.length; k += 1000) await api('/glucose/import', { method: 'POST', token: tk, body: { store: 'health_connect', items: g.slice(k, k + 1000) } });

    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['he', 'dark'], ['en', 'light']])) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', timezoneId: TZ, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const T = he
        ? { ov: 'סקירה', mealsToday: 'ארוחות היום', none: 'עוד לא נרשמו ארוחות היום.', fail: 'לא הצלחנו לטעון את הרשימה', retry: 'ניסיון נוסף', close: 'סגירה' }
        : { ov: 'Overview', mealsToday: 'Meals today', none: 'No meals logged today yet.', fail: "Couldn't load this list", retry: 'Try again', close: 'Close' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('mt@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await page.getByRole('tab', { name: T.ov }).first().click().catch(async () => page.getByText(T.ov, { exact: true }).last().click());
      await page.waitForTimeout(4000);
      const later = page.getByText(he ? 'אחר כך' : 'Later', { exact: true }).last();
      if (await later.isVisible().catch(() => false)) { await later.click(); await page.waitForTimeout(1000); }
      const text = async () => (await page.locator('body').innerText()).replace(/[⁦-⁩‎‏]/g, '');
      const tile = page.getByRole('button', { name: new RegExp(`^${T.mealsToday},`) }).first();
      const label = ((await tile.getAttribute('aria-label').catch(() => '')) || '').replace(/[⁦-⁩]/g, '');
      ok(`${lang}: tile counts 2 meals today`, label.endsWith(', 2'), label);
      const close = async () => { const c = page.getByRole('button', { name: T.close }).last(); if (await c.count()) await c.click(); else await page.goBack(); await page.waitForTimeout(2000); };

      let b;
      // 1. The first meals read fails (nothing kept yet): says so with a retry, never "no meals"; the retry brings them.
      await page.route('**/records?*', (route) => route.fulfill({ status: 500, body: '{"detail":"boom"}', headers: { 'content-type': 'application/json', 'access-control-allow-origin': base } }));
      await tile.evaluate((el) => el.click()); await page.waitForTimeout(3500);
      b = await text();
      ok(`${lang}: failed read says so`, b.includes(T.fail) && !b.includes(T.none), b.slice(-200));
      await shot('03-failed');
      await page.unroute('**/records?*');
      await page.getByRole('button', { name: T.retry }).last().click(); await page.waitForTimeout(3000);
      b = await text();
      ok(`${lang}: retry brings the meals`, b.includes('Tuna wrap') && b.includes('Eggs') && !b.includes(T.fail));
      await shot('04-retried');
      await close();
      // 2. The sheet lists the two meals.
      await tile.evaluate((el) => el.click()); await page.waitForTimeout(3500);
      b = await text();
      ok(`${lang}: sheet lists both meals`, b.includes('Tuna wrap') && b.includes('Eggs') && !b.includes(T.none));
      await shot('01-sheet');
      await close();

      // 3. A slow meals read: a spinner, not a blank sheet; the week's summary held back does not hold the list.
      let release; const gate = new Promise((r) => (release = r));
      await page.route('**/records?*', async (route) => { await gate; await route.continue(); });
      await page.route('**/nutrition/summary?*', async (route) => { await new Promise((r) => setTimeout(r, 8000)); await route.continue().catch(() => null); });
      await tile.evaluate((el) => el.click()); await page.waitForTimeout(1500);
      ok(`${lang}: spinner while the meals are read`, (await page.getByTestId('breakdown-loading').count()) > 0);
      await shot('02-loading');
      release(); await page.waitForTimeout(2500);
      b = await text();
      ok(`${lang}: meals shown before the summary answers`, b.includes('Tuna wrap') && b.includes('Eggs'));
      await page.unroute('**/records?*'); await page.unroute('**/nutrition/summary?*');
      await close();

      // 4. A later failed read (offline, server down) shows the meals kept from the last answer, as the tile does.
      await page.route('**/records?*', (route) => route.fulfill({ status: 503, body: '{}', headers: { 'content-type': 'application/json', 'access-control-allow-origin': base } }));
      await tile.evaluate((el) => el.click()); await page.waitForTimeout(3500);
      b = await text();
      ok(`${lang}: kept meals shown when the server fails`, b.includes('Tuna wrap') && b.includes('Eggs') && !b.includes(T.none));
      await page.unroute('**/records?*');
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
