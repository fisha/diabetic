// Choosing the Body today tiles (Guy, 16 Nov 2026) end-to-end check against the test server (services/api: uvicorn tests.e2e_server:app), which stands in for the model.
// Usage: node tools/e2e/body-tiles.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up b@example.com.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
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
    await api('/auth/sign-up', { method: 'POST', body: { email: 'b@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'b@example.com', password: 'correct horse battery' } })).json.access_token;
    await api('/profile', { method: 'PUT', token: tk, body: { locale: 'en', answers: { ...ANSWERS, ratios: { ...ANSWERS.ratios, target: '80-140' } } } });
    await api('/settings', { method: 'PUT', token: tk, body: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }).catch(() => null);
    const at = (h, m = 0, dayOff = 0) => { const d = new Date(); d.setDate(d.getDate() - dayOff); d.setHours(h, m, 0, 0); return d; };
    const hour = new Date().getHours();
    // Meals today: breakfast, a snack, lunch (only when the hour has passed).
    const meals = [[Math.min(8, hour), 'Eggs', 'Toast', 22, 18], [Math.min(10, hour), 'Yogurt', null, 9, 10], [Math.min(13, hour), 'Rice', 'Chicken', 48, 23]];
    let i = 0;
    for (const [h, a, b, carbs, protein] of meals) {
      const items = [{ name: a, unit: 'g', qty: 100, carbs_g: carbs, protein_g: protein, prov: 'wt', weighed: true }, ...(b ? [{ name: b, unit: 'g', qty: 50, carbs_g: 0, protein_g: 0, prov: 'est' }] : [])];
      const r = await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `bk-meal-${i++}`, kind: 'meal', occurred_at: at(h, 5).toISOString(), entered_at: new Date().toISOString(), source: 'manual', data: { items, ate: 'all', carbs_total_g: carbs, any_unknown: false, protein_total_g: protein } } });
      ok(`meal ${a} saved`, r.status === 200 || r.status === 201, String(r.status));
    }
    // Health data: steps by hour, heart rate, last night's stages with two awakenings, a week of steps and nights.
    const items = []; let n = 0;
    const s = (type, start, end, value, unit, data) => items.push({ type, sample_id: `bk-${String(n++).padStart(8, '0')}`, start: start.toISOString(), end: (end || start).toISOString(), value, unit, origin: 'com.apple.health.watch', ...(data ? { data } : {}) });
    for (let h = 0; h <= hour; h++) if (h >= 7) { s('steps', at(h, 10), at(h, 20), 300 + 120 * (h % 5), 'count'); s('distance', at(h, 10), at(h, 20), 250 + 90 * (h % 5), 'm'); s('heart_rate', at(h, 15), null, 70 + (h % 4) * 6, 'count/min'); s('heart_rate', at(h, 40), null, 85 + (h % 3) * 9, 'count/min'); }
    for (let h = 7; h <= Math.max(7, hour); h++) { s('exercise_time', at(h, 10), at(h, 20), 4 + (h % 3), 'min'); s('active_energy', at(h, 10), at(h, 20), 40 + 5 * (h % 4), 'kcal'); }
    for (let d = 0; d < 7; d++) {
      const bed = at(23, 10, d + 1); const mins = d === 0 ? 357 : 420 + 15 * d;
      const p = (o, l) => new Date(bed.getTime() + o * 60000);
      const parts = [['core', 0, 80], ['deep', 80, 150], ['awake', 150, 158], ['rem', 158, 230], ['core', 230, 300], ['awake', 300, 305], ['rem', 305, mins]];
      for (const [stage, a, b] of parts) s('sleep', p(a), p(b), null, null, { stage });
      if (d > 0) s('steps', at(12, 0, d), at(12, 30, d), 6000 + 400 * d, 'count');
      s('resting_heart_rate', at(7, 0, d), null, 58 + d % 3, 'count/min');
    }
    const r = await api('/health-data/samples', { method: 'POST', token: tk, body: { store: 'apple_health', items } });
    ok('health samples saved', r.status === 200, JSON.stringify(r.json).slice(0, 80));
    const det = (await api('/health-data/today/details', { token: tk })).json;
    ok('details: exercise and energy hours', det && det.exercise_hours.length > 0 && det.energy_hours.length > 0);
    ok('details: hours and last night', det && det.steps_hours.length > 0 && det.segments.length === 7, `${det && det.steps_hours.length} hours, ${det && det.segments.length} segments`);

    const tiles0 = (await api('/settings', { token: tk })).json.body_tiles;
    ok('default tiles are the first six', JSON.stringify(tiles0) === JSON.stringify(['steps', 'dist', 'hr', 'rest', 'sleep', 'awake']), JSON.stringify(tiles0));
    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']])) {
      await api('/settings', { method: 'PATCH', token: tk, body: { body_tiles: ['steps', 'dist', 'hr', 'rest', 'sleep', 'awake'] } });
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: { ...ANSWERS, ratios: { ...ANSWERS.ratios, target: '80-140' } } } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const T = he ? { awake: 'התעוררויות', ex: 'דקות אימון', energy: 'אנרגיה פעילה', pick: 'לבחור מה יוצג בכרטיס', title: 'הגוף היום', close: 'סגירה' } : { awake: 'Times awake', ex: 'Exercise', energy: 'Active energy', pick: 'Choose what this card shows', title: 'Body today', close: 'Close' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('b@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await shot('00-after-sign-in');
      await page.getByRole('tab', { name: he ? 'סקירה' : 'Overview' }).first().click().catch(async () => page.getByText(he ? 'סקירה' : 'Overview', { exact: true }).last().click());
      await page.waitForTimeout(4000);
      const tile = (text) => page.getByRole('button', { name: new RegExp(`^${text},`) }).first();
      const head = page.getByText(T.title, { exact: true }).first();
      await head.scrollIntoViewIfNeeded();
      const card = () => page.getByText(T.title, { exact: true }).first().locator('xpath=ancestor::div[2]');
      await card().screenshot({ path: path.join(out, `${lang}-${scheme}-01-card-default.png`) });
      ok(`${lang} ${scheme}: times awake shows by default`, (await tile(T.awake).count()) > 0);
      ok(`${lang} ${scheme}: exercise hidden by default`, (await tile(T.ex).count()) === 0);
      await page.getByRole('button', { name: T.pick }).first().click(); await page.waitForTimeout(2500);
      await shot('02-chooser');
      // Itay's wish, as his own choice: no times awake; and exercise and active energy on.
      await page.getByRole('switch', { name: T.awake }).first().click(); await page.waitForTimeout(1200);
      await page.getByRole('switch', { name: T.ex }).first().click(); await page.waitForTimeout(1200);
      await page.getByRole('switch', { name: T.energy }).first().click(); await page.waitForTimeout(1500);
      await shot('03-chooser-changed');
      const saved = (await api('/settings', { token: tk })).json.body_tiles;
      ok(`${lang} ${scheme}: saved by itself`, JSON.stringify(saved) === JSON.stringify(['steps', 'dist', 'hr', 'rest', 'sleep', 'exercise', 'energy']), JSON.stringify(saved));
      await page.getByRole('button', { name: T.close }).last().click(); await page.waitForTimeout(2000);
      await page.getByText(T.title, { exact: true }).first().scrollIntoViewIfNeeded();
      await card().screenshot({ path: path.join(out, `${lang}-${scheme}-04-card-changed.png`) });
      ok(`${lang} ${scheme}: times awake gone from the card`, (await tile(T.awake).count()) === 0);
      ok(`${lang} ${scheme}: exercise on the card`, (await tile(T.ex).count()) > 0);
      ok(`${lang} ${scheme}: active energy on the card`, (await tile(T.energy).count()) > 0);
      if (lang === 'en') {
        await tile(T.ex).click(); await page.waitForTimeout(2500);
        await shot('05-exercise-breakdown');
        ok('exercise breakdown opens', (await page.getByText(T.ex, { exact: true }).count()) > 0);
        await page.getByRole('button', { name: T.close }).last().click(); await page.waitForTimeout(1500);
      }
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
