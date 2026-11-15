// Tile breakdowns on Overview (Itay via Guy, 15 Nov 2026) end-to-end check against the test server (services/api: uvicorn tests.e2e_server:app), which stands in for the model.
// Usage: node tools/e2e/breakdown.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
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
    ok('details: hours and last night', det && det.steps_hours.length > 0 && det.segments.length === 7, `${det && det.steps_hours.length} hours, ${det && det.segments.length} segments`);

    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']])) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: { ...ANSWERS, ratios: { ...ANSWERS.ratios, target: '80-140' } } } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US' });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      page.setDefaultTimeout(6000);
      const L = lang === 'he' ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      // The app's language is chosen on the welcome screen.
      await page.goto(base); await page.waitForTimeout(2000);
      if (lang === 'he') { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('b@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await shot('00-after-sign-in');
      // The web session lives in the page: open Overview from the tab bar, not by reloading.
      await page.getByRole('tab', { name: lang === 'he' ? 'סקירה' : 'Overview' }).first().click().catch(async () => page.getByText(lang === 'he' ? 'סקירה' : 'Overview', { exact: true }).last().click());
      await page.waitForTimeout(4000);
      const label = lang === 'he' ? { steps: 'צעדים', sleep: 'שינה', awake: 'התעוררויות', protein: 'חלבון עד עכשיו', full: 'ימים מלאים', carbs: 'פחמימות עד עכשיו' } : { steps: 'Steps', sleep: 'Sleep', awake: 'Times awake', protein: 'Protein so far', full: 'Full days', carbs: 'Carbs so far' };
      for (const [key, text] of Object.entries(label)) {
        const tile = page.getByRole('button', { name: new RegExp(`^${text},`) }).first();
        await tile.scrollIntoViewIfNeeded().catch(() => null);
        if (key === 'steps') await shot('00-overview');
        const found = (await tile.count()) > 0;
        ok(`${lang} ${scheme}: ${key} tile is a button`, found);
        if (!found) continue;
        await tile.click(); await page.waitForTimeout(2500);
        await shot(`${key}`);
        if (key === 'protein' && lang === 'en') {
          // Guy, 15 Nov 2026: the breakdown can be edited. A meal opens in the meal editor, which saves by itself.
          await page.getByRole('button', { name: /^Rice, Chicken,/ }).first().click(); await page.waitForTimeout(2500);
          ok('meal editor opens from the breakdown', await page.getByText(/Editing a saved meal/).first().isVisible().catch(() => false));
          ok('no Save button while editing', (await page.getByText('Save correction', { exact: true }).count()) === 0);
          await page.getByRole('button', { name: /Tap to type the carbs of Rice/ }).first().click(); await page.waitForTimeout(300);
          await page.getByLabel(/Carbs in grams for Rice/).last().fill('60'); await page.keyboard.press('Enter'); await page.waitForTimeout(2500);
          ok('saved by itself', await page.getByText('Saved', { exact: true }).first().isVisible().catch(() => false));
          await shot('protein-edit');
          await page.getByRole('button', { name: 'Back' }).first().click(); await page.waitForTimeout(2500);
          const recs = (await api(`/records?kind=meal&since=${encodeURIComponent(at(0).toISOString())}&until=${encodeURIComponent(at(23, 59).toISOString())}`, { token: tk })).json || [];
          ok('the change reached the server', recs.some((r) => r.data.carbs_total_g === 60), recs.map((r) => r.data.carbs_total_g).join(','));
          ok('back on the breakdown', await page.getByRole('button', { name: 'Delete, Yogurt' }).first().isVisible().catch(() => false));
          await page.getByRole('button', { name: 'Delete, Yogurt' }).first().click(); await page.waitForTimeout(800);
          await shot('protein-delete-ask');
          await page.getByText('Delete entry', { exact: true }).last().click(); await page.waitForTimeout(2500);
          ok('deleted meal leaves the breakdown', (await page.getByText('Yogurt', { exact: true }).count()) === 0);
          await shot('protein-after-delete');
        }
        const closeBtn = page.getByRole('button', { name: lang === 'he' ? 'סגירה' : 'Close' }).last();
        if (await closeBtn.count()) await closeBtn.click(); else await page.goBack();
        await page.waitForTimeout(1500);
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
