// Every chosen Body today tile shows (Guy, 17 Nov 2026, PM-212) end-to-end check against the test server (services/api: uvicorn tests.e2e_server:app), which stands in for the model.
// Usage: node tools/e2e/body-tiles.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from a database without c@example.com: it signs up c@example.com. Today has steps, walking, heart rate and
// active energy only, as just after midnight: no night ending today, no resting heart rate and no exercise yet.
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
    await api('/auth/sign-up', { method: 'POST', body: { email: 'c@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'c@example.com', password: 'correct horse battery' } })).json.access_token;
    await api('/profile', { method: 'PUT', token: tk, body: { locale: 'en', answers: { ...ANSWERS, ratios: { ...ANSWERS.ratios, target: '80-140' } } } });
    const docs = (await api('/consent', { token: tk })).json;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
    await api('/settings', { method: 'PUT', token: tk, body: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }).catch(() => null);
    const at = (h, m = 0, dayOff = 0) => { const d = new Date(); d.setDate(d.getDate() - dayOff); d.setHours(h, m, 0, 0); return d; };
    const hour = new Date().getHours();
    const items = []; let n = 0;
    const s = (type, start, end, value, unit, data) => items.push({ type, sample_id: `pm212-${String(n++).padStart(8, '0')}`, start: start.toISOString(), end: (end || start).toISOString(), value, unit, origin: 'com.apple.health.watch', ...(data ? { data } : {}) });
    for (let h = 0; h <= hour; h++) { s('steps', at(h, 10), at(h, 20), 2 + h, 'count'); s('heart_rate', at(h, 15), null, 69 + (h % 4), 'count/min'); s('active_energy', at(h, 10), at(h, 20), 1, 'kcal'); s('distance', at(h, 10), at(h, 20), 1, 'm'); }
    // Earlier nights and resting heart rate, all before today: the new day has none yet.
    for (let d = 1; d < 8; d++) {
      const bed = at(23, 10, d + 1); const p = (o) => new Date(bed.getTime() + o * 60000);
      for (const [stage, a, b] of [['core', 0, 80], ['deep', 80, 150], ['awake', 150, 158], ['rem', 158, 420]]) s('sleep', p(a), p(b), null, null, { stage });
      s('resting_heart_rate', at(7, 0, d), null, 58 + (d % 3), 'count/min');
      s('exercise_time', at(12, 0, d), at(12, 20, d), 20, 'min');
    }
    const r = await api('/health-data/samples', { method: 'POST', token: tk, body: { store: 'apple_health', items } });
    ok('health samples saved', r.status === 200, JSON.stringify(r.json).slice(0, 80));
    const today = (await api('/health-data/today', { token: tk })).json;
    ok('today: no night, resting or exercise yet', today && today.night == null && today.resting == null && today.exercise_min == null, JSON.stringify(today).slice(0, 160));
    const ALL = ['steps', 'dist', 'hr', 'rest', 'sleep', 'awake', 'exercise', 'energy'];
    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']])) {
      await api('/settings', { method: 'PATCH', token: tk, body: { body_tiles: ALL } });
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: { ...ANSWERS, ratios: { ...ANSWERS.ratios, target: '80-140' } } } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const T = he
        ? { names: ['צעדים', 'הליכה וריצה', 'דופק ממוצע', 'דופק במנוחה', 'שינה', 'התעוררויות', 'דקות אימון', 'אנרגיה פעילה'], none: 'אין נתונים היום', title: 'הגוף היום', close: 'סגירה' }
        : { names: ['Steps', 'Walk and run', 'Avg heart rate', 'Resting', 'Sleep', 'Times awake', 'Exercise', 'Active energy'], none: 'No data today', title: 'Body today', close: 'Close' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('c@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-00-after-sign-in.png`) });
      await page.getByRole('tab', { name: he ? 'סקירה' : 'Overview' }).first().click().catch(async () => page.getByText(he ? 'סקירה' : 'Overview', { exact: true }).last().click());
      await page.waitForTimeout(4000);
      await page.getByText(T.title, { exact: true }).first().scrollIntoViewIfNeeded();
      const card = page.getByText(T.title, { exact: true }).first().locator('xpath=ancestor::div[2]');
      await card.screenshot({ path: path.join(out, `${lang}-${scheme}-01-all-chosen.png`) });
      const tiles = await page.locator('[role="button"][aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')).filter(Boolean));
      const shown = T.names.filter((nm) => tiles.some((l) => l.startsWith(nm + ',')));
      ok(`${lang} ${scheme}: all 8 chosen tiles show`, shown.length === 8, `${shown.length}: ${shown.join(' / ')}`);
      const empty = tiles.filter((l) => l.includes(T.none));
      ok(`${lang} ${scheme}: 4 tiles say no data today`, empty.length === 4, empty.join(' | '));
      if (lang === 'en' && shown.includes('Sleep')) {
        await page.getByRole('button', { name: /^Sleep,/ }).first().click(); await page.waitForTimeout(2500);
        await page.screenshot({ path: path.join(out, `${lang}-${scheme}-02-sleep-breakdown.png`) });
        ok('empty sleep tile still opens its breakdown', (await page.getByRole('button', { name: T.close }).count()) > 0);
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
