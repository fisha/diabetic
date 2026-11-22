// Owner-only glucose estimate experiment (PM-413), end-to-end against the test server (services/api: uvicorn
// tests.e2e_server:app on port 8000). The account gets 20 days of simulated test data (tests/test_forecast.py _days,
// test fixtures only), the flag, and kept estimates every 30 minutes over the last 36 hours (SEED: a script that does
// that for an email). Checks: the dashed line and its label on today and yesterday, and nothing for another account.
// Usage: SEED="uv run --directory services/api python tests/e2e_forecast_seed.py" node tools/e2e/forecast.cjs <web export> <screenshot dir>
const http = require('http'); const fs = require('fs'); const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const TZ = 'Asia/Jerusalem';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token } = {}, again = true) => {
  // One retry: a kept-alive connection the server closed while the seed ran fails once.
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }).catch((e) => {
    if (!again) throw e;
    return null;
  });
  if (r === null) return api(p, { method, body, token }, false);
  return { status: r.status, json: await r.json().catch(() => null) };
};
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '70-180', target: '70-180' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };

async function account(email) {
  await api('/auth/sign-up', { method: 'POST', body: { email, password: 'correct horse battery' } });
  const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: 'correct horse battery' } })).json.access_token;
  const docs = (await api('/consent', { token: tk })).json;
  await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
  await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
  return tk;
}

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    const tk = await account('owner@example.com');
    const other = await account('other@example.com');
    if (process.env.SEED) execSync(`${process.env.SEED} owner@example.com`, { stdio: 'inherit' });
    const day = await api('/forecast/day', { token: tk });
    ok('owner gets a live estimate and a backtest', day.status === 200 && day.json.live && day.json.live.points.length > 0 && day.json.model.backtest.length > 0);
    ok('another account gets 404', (await api('/forecast/day', { token: other })).status === 404);
    const runs = process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']];
    for (const [lang, scheme] of runs) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', timezoneId: TZ, deviceScaleFactor: 2 });
      const page = await ctx.newPage(); global.lastPage = page;
      page.on('pageerror', (e) => { errors.push(e.message); if (process.env.STACK) console.log(e.stack); });
      page.setDefaultTimeout(8000);
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      const he = lang === 'he';
      const L = he
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', tab: 'סקירה', legend: 'הערכה (ניסוי)', note: /^קו מקווקו: הערכה ניסיונית/, prev: 'התקופה הקודמת' }
        : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', tab: 'Overview', legend: 'Estimate (experiment)', note: /^Dashed line: an experimental estimate/, prev: 'Previous period' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('owner@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await page.getByRole('tab', { name: L.tab, exact: true }).click(); await page.waitForTimeout(4000);
      // The companion's unlock card for the simulated sensor days, if it shows.
      const later = page.getByText(he ? 'אחר כך' : 'Later', { exact: true });
      if (await later.isVisible().catch(() => false)) { await later.click(); await page.waitForTimeout(1000); }
      const legend = page.getByText(L.legend, { exact: true });
      await legend.scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(800);
      await shot('01-today');
      ok(`${lang}-${scheme} today: dashed-line legend and the experiment note`, (await legend.isVisible()) && (await page.getByText(L.note).isVisible()));
      await page.getByRole('button', { name: L.prev }).first().click(); await page.waitForTimeout(3500);
      await legend.scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(800);
      await shot('02-yesterday');
      ok(`${lang}-${scheme} yesterday: the estimates beside the readings`, await legend.isVisible());
      await ctx.close();
    }
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
