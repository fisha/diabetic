// The Overview's 24h filter (Guy, 23 Nov 2026, PM-420: "אני על פילטור של 24 שעות וארוחות ופחמימות מראה 0 למרות שהזנתי
// ארוחות"): the Food and Body tiles count the last 24 hours, not the calendar day, also right after midnight; Day stays the
// calendar day. End-to-end against the test server (services/api: uvicorn tests.e2e_server:app).
// Usage: node tools/e2e/rolling-24h.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up r24@example.com. The phone's zone is Asia/Jerusalem.
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
    await api('/auth/sign-up', { method: 'POST', body: { email: 'r24@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'r24@example.com', password: 'correct horse battery' } })).json.access_token;
    const docs = (await api('/consent', { token: tk })).json;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    await api('/profile', { method: 'PUT', token: tk, body: { locale: 'en', answers: ANSWERS } });
    await api('/settings', { method: 'PATCH', token: tk, body: { timezone: TZ } });
    const now = Date.now(); const H = 3_600_000; const mid = localMidnight();
    const ago = (h) => new Date(now - h * H);
    // A meal 11 h 40 min ago (Guy's 13:34 seen at 01:13) and one outside the 24 hours.
    const meals = [[11.67, 'Tuna wrap', 54, 20], [30, 'Old pasta', 99, 10]];
    let i = 0;
    for (const [h, name, carbs, protein] of meals) {
      const items = [{ name, unit: 'g', qty: 100, carbs_g: carbs, protein_g: protein, prov: 'wt', weighed: true }];
      const r = await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `r24-meal-${i++}`, kind: 'meal', occurred_at: ago(h).toISOString(), entered_at: new Date().toISOString(), source: 'manual', data: { items, ate: 'all', carbs_total_g: carbs, protein_total_g: protein, any_unknown: false } } });
      ok(`meal ${name} saved`, r.status < 300, String(r.status));
    }
    // Two days of sensor readings, so the Overview shows its periods.
    const g = []; for (let t = now - 2 * 86400000, k = 0; t < now - 180000; t += 5 * 60000, k++) g.push({ sample_id: `e2e-r24-glucose-${String(k).padStart(6, "0")}`, measured_at: new Date(t).toISOString(), value: 110 + ((k * 13) % 50), unit: 'mg/dL', method: 'sensor' });
    for (let k = 0; k < g.length; k += 1000) await api('/glucose/import', { method: 'POST', token: tk, body: { store: 'health_connect', items: g.slice(k, k + 1000) } });
    const items = []; let n = 0;
    const s = (type, start, value, unit) => items.push({ type, sample_id: `r24-${String(n++).padStart(8, '0')}`, start: start.toISOString(), end: new Date(start.getTime() + 600_000).toISOString(), value, unit, origin: 'com.apple.health.watch' });
    s('steps', ago(20), 2240, 'count'); s('steps', ago(0.2), 18, 'count'); s('steps', ago(26), 9999, 'count');
    s('heart_rate', ago(20), 70, 'count/min'); s('heart_rate', ago(0.3), 74, 'count/min');
    const r = await api('/health-data/samples', { method: 'POST', token: tk, body: { store: 'apple_health', items, window_types: ['steps', 'heart_rate'] } });
    ok('health samples saved', r.status === 200, JSON.stringify(r.json).slice(0, 80));
    const w = (await api('/health-data/window?hours=24', { token: tk })).json;
    ok('API: steps over the last 24 hours', w && w.steps === 2258, JSON.stringify(w && w.steps));
    const mealToday = now - 11.67 * H >= mid; const stepsToday = now - 20 * H >= mid;

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
        ? { ov: 'סקירה', food24: 'תזונה ב-24 השעות האחרונות', body24: 'הגוף ב-24 השעות האחרונות', foodDay: 'תזונה היום', bodyDay: 'הגוף היום', meals: 'ארוחות', mealsToday: 'ארוחות היום', carbs: 'פחמימות', steps: 'צעדים', p24: '24 ש׳', day: 'יום' }
        : { ov: 'Overview', food24: 'Food, last 24 hours', body24: 'Body, last 24 hours', foodDay: 'Food today', bodyDay: 'Body today', meals: 'Meals', mealsToday: 'Meals today', carbs: 'Carbs', steps: 'Steps', p24: '24h', day: 'Day' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('r24@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await page.getByRole('tab', { name: T.ov }).first().click().catch(async () => page.getByText(T.ov, { exact: true }).last().click());
      await page.waitForTimeout(4000);
      const later = page.getByText(he ? 'אחר כך' : 'Later', { exact: true }).last();
      if (await later.isVisible().catch(() => false)) { await later.click(); await page.waitForTimeout(1000); }
      const text = async () => (await page.locator('body').innerText()).replace(/[⁦-⁩‎‏]/g, '');
      const pick = async (label) => {
        const re = new RegExp(`^[\u2066-\u2069\u200e\u200f]*${label}[\u2066-\u2069\u200e\u200f]*$`);
        for (const role of ['radio', 'tab', 'button']) {
          const el = page.getByRole(role, { name: re }).first();
          if (await el.count()) { await el.click(); break; }
          if (role === 'button') await page.getByText(re).first().click();
        }
        await page.waitForTimeout(3500);
      };
      // Day: the calendar day.
      let b = await text();
      ok(`${lang}: Day shows "${T.foodDay}"`, b.includes(T.foodDay));
      await pick(T.p24);
      b = await text();
      ok(`${lang}: 24h titles`, b.includes(T.food24) && b.includes(T.body24), (b.match(/(Food|Body|תזונה|הגוף)[^\n]*/g) || []).join(' | '));
      ok(`${lang}: 24h no "today" titles`, !b.includes(T.foodDay) && !b.includes(T.bodyDay));
      const mealTile = page.getByRole('button', { name: new RegExp(`^${T.meals},`) }).first();
      const mealLabel = (await mealTile.getAttribute('aria-label').catch(() => '')) || '';
      ok(`${lang}: 24h meals = 1`, mealLabel.replace(/[\u2066-\u2069]/g, '').endsWith(', 1'), mealLabel);
      const carbLabel = (await page.getByRole('button', { name: new RegExp(`^${T.carbs},`) }).first().getAttribute('aria-label').catch(() => '')) || '';
      ok(`${lang}: 24h carbs 54 g`, /54/.test(carbLabel), carbLabel);
      const stepLabel = (await page.getByRole('button', { name: new RegExp(`^${T.steps},`) }).first().getAttribute('aria-label').catch(() => '')) || '';
      ok(`${lang}: 24h steps 2,258`, /2,258|2258/.test(stepLabel), stepLabel);
      const food = page.getByText(T.food24, { exact: true }).first();
      await food.scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollBy(0, -330));
      await page.waitForTimeout(500);
      await shot('01-24h');
      // The meals tile opens the same 24 hours.
      await mealTile.evaluate((el) => el.click()); await page.waitForTimeout(3000);
      b = await text();
      ok(`${lang}: sheet lists the 24 hours' meal`, b.includes('Tuna wrap') && !b.includes('Old pasta'));
      await shot('02-meals-sheet');
      await page.goBack(); await page.waitForTimeout(2500);
      // Day again: calendar day.
      await pick(T.day);
      b = await text();
      ok(`${lang}: Day back to today's titles`, b.includes(T.bodyDay));
      if (!mealToday) ok(`${lang}: Day has no meal tile count from yesterday`, !b.includes(T.food24));
      if (!stepsToday) {
        const sd = (await page.getByRole('button', { name: new RegExp(`^${T.steps},`) }).first().getAttribute('aria-label').catch(() => '')) || '';
        ok(`${lang}: Day steps are since midnight (18)`, /\b18\b/.test(sd), sd);
      }
      await shot('03-day');
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
