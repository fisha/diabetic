// Learning days (Guy, 15 Nov 2026): the Overview learning bar counts the same day 1 as the routine card and opens the
// per-day screen. End-to-end against the test server (services/api: uvicorn tests.e2e_server:app) and its own database.
// Usage: DB=postgresql://steady:steady@localhost:5432/steady_e2e node tools/e2e/learning.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up l@example.com, moves the account to four days ago and adds insights shown on day 3.
const http = require('http'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000'; const DB = process.env.DB;
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const sql = (q) => execFileSync('psql', [DB, '-v', 'ON_ERROR_STOP=1', '-qtAc', q]).toString().trim();
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '80-140' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'l@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'l@example.com', password: 'correct horse battery' } })).json.access_token;
    await api('/profile', { method: 'PUT', token: tk, body: { locale: 'en', answers: ANSWERS } });
    await api('/settings', { method: 'PUT', token: tk, body: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }).catch(() => null);
    const at = (h, m = 0, dayOff = 0) => { const d = new Date(); d.setDate(d.getDate() - dayOff); d.setHours(h, m, 0, 0); return d; };
    const uid = sql("select id from users where email = 'l@example.com'");
    sql(`update users set created_at = '${at(12, 0, 4).toISOString()}' where id = '${uid}'`);
    let i = 0;
    for (const [off, h, m] of [[4, 8, 20], [3, 8, 40], [3, 13, 5], [2, 8, 30], [2, 19, 0], [1, 13, 30]]) {
      await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `learn-meal-${i++}`, kind: 'meal', occurred_at: at(h, m, off).toISOString(), entered_at: at(h, m, off).toISOString(), source: 'manual', data: { items: [{ name: 'Toast', unit: 'g', qty: 60, carbs_g: 30, prov: 'est' }], ate: 'all', carbs_total_g: 30, any_unknown: false } } });
      await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `learn-insulin-${i++}`, kind: 'insulin', occurred_at: at(h, m, off).toISOString(), entered_at: at(h, m, off).toISOString(), source: 'manual', data: { insulin: 'Rapid', units: 3 } } });
    }
    const shown = at(9, 0, 2);
    for (const key of ['above:evening', 'below:night', 'rise:breakfast']) {
      sql(`insert into insight_exposures (id, user_id, key, family, topic_version, day, surface, first_shown_at, last_shown_at, shows, rank, candidates, engine, rules_version, ranker_mode, evidence)
           values (gen_random_uuid(), '${uid}', '${key}', 'range', 1, '${shown.toLocaleDateString('sv')}', 'app', '${shown.toISOString()}', '${shown.toISOString()}', 1, 0, 3, 'rules', 'r', 'shadow', '{}')`);
    }
    const days = (await api('/insights/learning/days', { token: tk })).json;
    ok('server: today is day 5, first examples on day 10', days && days.today === 5 && days.first_ready_day === 10, JSON.stringify(days && { today: days.today, ready: days.first_ready_day }));
    const fam = (await api('/insights/familiarization', { token: tk })).json;

    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']])) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, locale: 'en-US' });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = (name, full) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`), fullPage: !!full });
      page.setDefaultTimeout(6000);
      const L = lang === 'he' ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', ovr: 'סקירה', t: 'למידה', day4: 'יום 4' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', ovr: 'Overview', t: 'Learning', day4: 'Day 4' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (lang === 'he') { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('l@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await shot('00-after-sign-in');
      await page.getByRole('tab', { name: L.ovr }).first().click().catch(async () => page.getByText(L.ovr, { exact: true }).last().click());
      await page.waitForTimeout(4000);
      // A companion unlock (four days in a row) may open first; it is not part of this check.
      const later = page.getByText(lang === 'he' ? 'אחר כך' : 'Later', { exact: true }).last();
      if (await later.isVisible().catch(() => false)) { await later.click(); await page.waitForTimeout(800); }
      const bar = page.getByRole('button', { name: new RegExp(`^${L.t}:`) }).first();
      await bar.scrollIntoViewIfNeeded().catch(() => null);
      const found = (await bar.count()) > 0;
      ok(`${lang} ${scheme}: the learning bar is a button`, found);
      await shot('01-overview-bar');
      if (!found) { await ctx.close(); continue; }
      const label = await bar.getAttribute('aria-label');
      ok(`${lang} ${scheme}: the bar says day 5 and day 10`, /5/.test(label) && /10/.test(label), label);
      await bar.click(); await page.waitForTimeout(3000);
      await shot('02-learning-days');
      await shot('02-learning-days-full', true);
      const t4 = page.getByRole('button', { name: new RegExp(`^${L.day4},`) }).first();
      ok(`${lang} ${scheme}: day tiles`, (await t4.count()) > 0);
      for (const n of [2, 3]) {
        const tile = page.getByRole('button', { name: new RegExp(`^${lang === 'he' ? 'יום' : 'Day'} ${n},`) }).first();
        if (await tile.count()) { await tile.click(); await page.waitForTimeout(600); await shot(`03-day-${n}`, true); }
      }
      if (lang === 'en') {
        const text = await page.locator('body').innerText();
        ok('day 3 lists the insights shown and when they become examples', /3 insights were shown to you/.test(text) && /on day\s*\u2066?10/.test(text));
      }
      const t10 = page.getByRole('button', { name: new RegExp(`^${lang === 'he' ? 'יום 10' : 'Day 10'},`) }).first();
      ok(`${lang} ${scheme}: day 10 is the first examples' day`, (await t10.count()) > 0);
      await ctx.close();
    }
    ok('routine card counts the same day (past its first days here)', fam && fam.day === null, JSON.stringify(fam && fam.day));
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
