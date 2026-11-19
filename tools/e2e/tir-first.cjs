// Overview: the time-in-range card sits right under the latest reading and above the graph (Guy, 17 Nov 2026) and
// names the range it counts against (19 Nov 2026),
// end to end against the test server (services/api: uvicorn tests.e2e_server:app).
// Usage: node tools/e2e/tir-first.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Signs up tir@example.com with synthetic readings for this check only (start from a database without that account).
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
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '80-140' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm', classic: true }, checkIns: { frequency: 'moreAtFirst' } };
const EMAIL = 'tir@example.com'; const PW = 'correct horse battery';

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  let page;
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: EMAIL, password: PW } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: EMAIL, password: PW } })).json.access_token;
    const docs = (await api('/consent', { token: tk })).json;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    // Two days of 5-minute sensor readings up to a few minutes ago.
    const items = []; let n = 0;
    for (let t = Date.now() - 2 * 86400000; t < Date.now() - 180000; t += 5 * 60000) {
      items.push({ sample_id: `e2e-tir-${n}`, measured_at: new Date(t).toISOString(), value: 110 + ((n * 13) % 90), unit: 'mg/dL', method: 'sensor' }); n++;
    }
    await api('/glucose/import', { method: 'POST', token: tk, body: { store: 'health_connect', items } });

    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']])) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', ov: 'סקירה' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', ov: 'Overview' };
      const T = he ? { latest: 'המדידה האחרונה', today: 'היום עד עכשיו', tir: 'זמן בטווח', day: 'יום', time: 'לאורך הזמן', week: 'שבוע', weekSum: 'השבוע' } : { latest: 'Latest reading', today: 'Today so far', tir: 'Time in range', day: 'Day', time: 'Over time', week: 'Week', weekSum: 'This week' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill(EMAIL);
      await page.getByLabel(L.pw, { exact: true }).fill(PW);
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      await page.getByText(L.ov, { exact: true }).last().click(); await page.waitForTimeout(5000);
      const radio = (name) => page.getByRole('radio', { name, exact: true }).first();
      // The main screen stays mounted behind Overview with its own time-in-range tile at the top: measure the lowest match.
      const y = async (loc) => {
        const ys = [];
        for (const l of await loc.filter({ visible: true }).all()) ys.push((await l.boundingBox())?.y ?? NaN);
        return ys.length ? Math.max(...ys) : NaN;
      };
      await radio(T.day).click(); await page.waitForTimeout(3000);
      const yLatest = await y(page.getByText(T.latest, { exact: true }));
      const ySum = await y(page.getByText(T.today, { exact: true }));
      const yTir = await y(page.getByText(T.tir, { exact: true }));
      const yPeriod = await y(radio(T.day));
      const yGraph = await y(radio(T.time));
      ok(`${lang} ${scheme}: time in range under the latest reading`, yLatest < ySum && ySum < yTir, JSON.stringify({ yLatest, ySum, yTir }));
      ok(`${lang} ${scheme}: time in range above the period and the graph`, yTir < yPeriod && yPeriod < yGraph, JSON.stringify({ yTir, yPeriod, yGraph }));
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-01-day.png`) });
      await radio(T.week).click(); await page.waitForTimeout(3000);
      ok(`${lang} ${scheme}: card follows the chosen period`, (await page.getByText(T.weekSum, { exact: true }).count()) > 0);
      // The card names the range it counts against (Guy, 19 Nov 2026): the typed 80-140 here.
      // The numbers are wrapped in direction marks, so match around them.
      const rangeText = he ? /הטווח שלך\W*80\W140/ : /Your range\W*80\W140/;
      ok(`${lang} ${scheme}: card shows the range`, (await page.getByText(rangeText).count()) > 0);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-02-week.png`) });
      await ctx.close();
    }
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); if (page) await page.screenshot({ path: path.join(out, 'zz-fail.png') });
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
  process.exit(results.some((r) => !r.startsWith('PASS')) ? 1 : 0);
});
