// Back from an entry opened in the Journal returns to the same place (Naama, 28 Nov 2026, PM-642): the Meals tab with
// its option and the scroll place, not the top of All. End-to-end against the test server (services/api:
// uvicorn tests.e2e_server:app on port 8000). Synthetic meals are put in the e2e database with psql. Android's hardware
// back button can't be pressed on the web; it calls the same close as the screen's back button.
// Usage: PGURL=postgresql://steady@/steady?host=/tmp/pg node tools/e2e/journal-back.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up jb@example.com.
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
    await api('/auth/sign-up', { method: 'POST', body: { email: 'jb@example.com', password: 'correct horse battery' } });
    const signIn = (await api('/auth/sign-in', { method: 'POST', body: { email: 'jb@example.com', password: 'correct horse battery' } })).json;
    const tk = signIn.access_token;
    const uid = sql("select id from users where email = 'jb@example.com'");
    sql(`update users set approved_at = now() where id = '${uid}'`);
    const docs = (await api('/consent', { token: tk })).json;
    if (docs && docs.documents) await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    // Four meals a day for the last six days and an insulin dose beside each, so the Meals list scrolls.
    const rows = [];
    for (let d = 0; d < 6; d++) {
      for (const [h, g, name] of [[8, 40, 'Oatmeal'], [12, 25, 'Salad'], [16, 15, 'Apple'], [20, 60, 'Pasta']]) {
        const t = new Date(); t.setDate(t.getDate() - d); t.setHours(h, 0, 0, 0);
        if (t.getTime() > Date.now()) continue;
        const at = t.toISOString();
        const meal = { items: [{ name: `${name} ${d}`, grams: 100, carbs_g: g, prov: 'db' }], ate: 'all', carbs_total_g: g, any_unknown: false };
        rows.push(`(gen_random_uuid(), '${uid}', 'jb-m${d}-${h}', 'meal', '${at}', '${at}', 'app', '${JSON.stringify(meal)}', 1, false)`);
        const ins = new Date(t.getTime() + 90 * 60_000).toISOString();
        rows.push(`(gen_random_uuid(), '${uid}', 'jb-i${d}-${h}', 'insulin', '${ins}', '${ins}', 'app', '${JSON.stringify({ insulin: 'NovoRapid', units: 2, reason: 'correction' })}', 1, false)`);
      }
    }
    sql(`insert into records (id, user_id, idempotency_key, kind, occurred_at, entered_at, source, data, revision, hidden) values ${rows.join(',')}`);

    const runs = process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'dark']];
    for (const [lang, scheme] of runs) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      // Signed in already: on the web the app's own sign-in goes to the website (PM-593).
      const stored = { refreshToken: signIn.refresh_token, email: 'jb@example.com', hasProfile: true, access: { token: tk, until: Date.now() + 10 * 60000 } };
      await ctx.addInitScript(([st, lng]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('steady.session', JSON.stringify(st)); localStorage.setItem('steady.preferences', JSON.stringify({ locale: lng, takeBreak: false })); }, [stored, lang]);
      const page = await ctx.newPage(); global.lastPage = page;
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      const L = lang === 'he'
        ? { tab: 'יומן', all: 'הכול', meal: 'ארוחות', back: 'חזרה ליומן' }
        : { tab: 'Journal', all: 'All', meal: 'Meals', back: 'Back to journal' };
      await page.goto(base + '/'); await page.waitForTimeout(6000);
      if (await page.getByTestId('break-end').count()) { await page.getByTestId('break-end').click(); await page.goto(base + '/'); await page.waitForTimeout(5000); }
      await page.getByRole('tab', { name: L.tab, exact: true }).click(); await page.waitForTimeout(3000);
      const tab = (name) => page.getByRole('tab', { name: new RegExp(`^${name}`) }).first();
      const selected = async (name) => (await tab(name).getAttribute('aria-selected')) === 'true';
      // The journal's list: the visible vertical scroller that holds the meal rows.
      const scrollTop = () => page.evaluate(() => {
        const els = [...document.querySelectorAll('div')].filter((el) => el.scrollHeight > el.clientHeight + 50 && getComputedStyle(el).overflowY !== 'visible' && el.offsetParent !== null && el.textContent.includes('Pasta'));
        const el = els.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
        return el ? el.scrollTop : -1;
      });
      const scrollBy = (y) => page.evaluate((dy) => {
        const els = [...document.querySelectorAll('div')].filter((el) => el.scrollHeight > el.clientHeight + 50 && getComputedStyle(el).overflowY !== 'visible' && el.offsetParent !== null && el.textContent.includes('Pasta'));
        const el = els.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
        if (el) el.scrollTop += dy;
      }, y);

      await tab(L.meal).click(); await page.waitForTimeout(1000);
      ok(`${lang}-${scheme} Meals tab selected`, await selected(L.meal));
      await scrollBy(700); await page.waitForTimeout(1200);
      const before = await scrollTop();
      ok(`${lang}-${scheme} list scrolled`, before > 300, `scrollTop ${before}`);
      await shot('01-meals-scrolled');
      const row = page.getByText(/Oatmeal \d|Salad \d|Apple \d|Pasta \d/).filter({ visible: true });
      // Playwright would scroll a row above the screen into view first: pick one whose box is inside the window.
      let pick = -1;
      for (let i = 0; i < (await row.count()); i++) { const b = await row.nth(i).boundingBox(); if (b && b.y > 250 && b.y < 600) { pick = i; break; } }
      const name = (await row.nth(pick).textContent()).trim();
      await row.nth(pick).click(); await page.waitForTimeout(1200);
      const back = page.getByRole('button', { name: L.back, exact: true }).filter({ visible: true });
      ok(`${lang}-${scheme} meal opens`, (await back.count()) === 1, name);
      await shot('02-meal-open');
      await back.click(); await page.waitForTimeout(1200);
      ok(`${lang}-${scheme} back keeps the Meals tab`, await selected(L.meal));
      ok(`${lang}-${scheme} back keeps the All tab unselected`, !(await selected(L.all)));
      const after = await scrollTop();
      ok(`${lang}-${scheme} back keeps the scroll place`, Math.abs(after - before) < 5, `${before} -> ${after}`);
      ok(`${lang}-${scheme} the opened meal is on screen again`, (await page.getByText(name, { exact: true }).filter({ visible: true }).count()) > 0, name);
      await shot('03-back');
      await ctx.close();
    }
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); if (global.lastPage) await global.lastPage.screenshot({ path: path.join(out, 'zz-fail.png') });
  }
  console.log(results.join('\n'));
  console.log(errors.length ? 'page errors:\n' + [...new Set(errors)].join('\n') : 'no page errors');
  await browser.close(); server.close();
});
