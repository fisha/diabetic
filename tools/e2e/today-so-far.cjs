// Today so far (PM-309, Guy 19 Nov 2026): each routine in today's summary says what happened today, next to the usual
// days ("two hours after dinner today" against the last 14 days). Patterns not tied to today sit under More patterns.
// End-to-end against the test server (services/api: uvicorn tests.e2e_server:app). Synthetic readings for this check only.
// Usage: node tools/e2e/today-so-far.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up today@example.com. Run it after 21:00 local time, so today's dinner
// (18:30) and its two hours have passed.
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
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '70-180' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Stedio', style: 'warm', classic: true }, checkIns: { frequency: 'moreAtFirst' } };
const EMAIL = 'today@example.com'; const PW = 'correct horse battery';
const H = 3_600_000;

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8093, async () => {
  const base = 'http://localhost:8093';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: EMAIL, password: PW } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: EMAIL, password: PW } })).json.access_token;
    const docs = (await api('/consent', { token: tk })).json;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    const now = Date.now();
    const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
    const today0 = midnight.getTime();
    // Dinner at 18:30 on each of the last 14 days and today; lunch at 13:00 on the earlier days only (none today).
    const dinners = []; const lunches = [];
    for (let d = 14; d >= 0; d--) {
      dinners.push(today0 - d * 24 * H + 18.5 * H);
      if (d > 0) lunches.push(today0 - d * 24 * H + 13 * H);
    }
    // Usual days: 134 at dinner, 153 two hours after; lunch 132 -> 165; mornings in range. Today: 118 at dinner, 176 two
    // hours after, and the morning above the range.
    const value = (t) => {
      const today = t >= today0;
      for (const m of dinners) if (t >= m - 0.25 * H && t <= m + 3 * H) {
        const [a, b] = today ? [118, 176] : [134, 153];
        const x = Math.max(0, Math.min(1, (t - m) / (2 * H)));
        return Math.round(a + (b - a) * x);
      }
      for (const m of lunches) if (t >= m - 0.25 * H && t <= m + 3 * H) {
        const x = Math.max(0, Math.min(1, (t - m) / (2 * H)));
        return Math.round(132 + 33 * x);
      }
      const h = new Date(t).getHours();
      if (today && h >= 5 && h < 11) return 205;
      return 120 + ((t / 300000) % 9);
    };
    const items = []; let n = 0;
    for (let t = today0 - 14 * 24 * H; t < now - 3 * 60000; t += 5 * 60000) {
      items.push({ sample_id: `e2e-ts-${n++}`, measured_at: new Date(t).toISOString(), value: value(t), unit: 'mg/dL', method: 'sensor' });
    }
    for (let i = 0; i < items.length; i += 1000) await api('/glucose/import', { method: 'POST', token: tk, body: { store: 'health_connect', items: items.slice(i, i + 1000) } });
    let k = 0;
    for (const m of [...dinners, ...lunches]) {
      if (m > now) continue;
      const at = new Date(m).toISOString();
      await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `ts-meal-${k++}`, kind: 'meal', occurred_at: at, entered_at: at, source: 'manual', data: { items: [{ name: 'Rice and chicken', unit: 'g', qty: 300, carbs_g: 50, prov: 'user' }], ate: 'all', carbs_total_g: 50, any_unknown: false } } });
    }
    const ins = (await api('/insights', { token: tk })).json;
    ok('dinner pattern on the server', ins.meal_patterns.some((p) => p.key === 'rise:dinner' && p.start_mgdl === 134 && p.end_mgdl === 153), JSON.stringify(ins.meal_patterns.map((p) => [p.key, p.start_mgdl, p.end_mgdl])));
    const runs = process.env.ONLY ? [process.env.ONLY.split(':')] : [['he', 'dark'], ['he', 'light'], ['en', 'light']];
    for (const [lang, scheme] of runs) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage(); global.lastPage = page;
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      const L = he
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', read: 'לקריאת הסיכום', today: 'היום', usual: 'בדרך כלל', more: 'עוד דפוסים' }
        : { email: 'Email', pw: 'Password', go: 'Sign in', read: 'Read summary', today: 'Today', usual: 'Usually', more: 'More patterns' };
      const tag = `${lang} ${scheme}`;
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(800); }
      await page.getByText(he ? 'כבר יש לי חשבון' : 'I already have an account').last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill(EMAIL);
      await page.getByLabel(L.pw, { exact: true }).fill(PW);
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      await page.goto(`${base}/overview`); await page.waitForTimeout(6000);
      await page.getByText(L.read, { exact: true }).first().click(); await page.waitForTimeout(2500);
      const dinner = he ? /ארוחת ערב ב־.*לפני .*118.*שעתיים אחרי .*176/ : /dinner at .*118.*before, .*176.*two hours after/;
      ok(`${tag}: today after dinner`, await page.getByText(dinner).first().isVisible().catch(() => false));
      const usual = he ? /לפני .*134.*שעתיים אחרי .*153.*ב־15 ארוחות|לפני .*134.*שעתיים אחרי .*153/ : /134.*before, .*153.*two hours after/;
      ok(`${tag}: usual dinners`, await page.getByText(usual).first().isVisible().catch(() => false));
      ok(`${tag}: morning above today`, await page.getByText(he ? /מעל הטווח שלך/ : /above your range \(/).first().isVisible().catch(() => false));
      ok(`${tag}: no lunch today`, (await page.getByText(he ? 'שעתיים אחרי ארוחת צהריים' : 'Two hours after lunch', { exact: true }).count()) === 0);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-01-today.png`) });
      await page.mouse.move(220, 600); await page.mouse.wheel(0, 700); await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-02-today-more.png`) });
      await ctx.close();
    }
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); if (global.lastPage) await global.lastPage.screenshot({ path: path.join(out, 'zz-fail.png') });
  }
  console.log(results.join('\n')); console.log(errors.length ? 'page errors: ' + errors.join(' | ') : 'no page errors');
  await browser.close(); server.close();
});
