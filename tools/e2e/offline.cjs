// Past data when the server can't be reached (Guy, 16 Nov 2026) end-to-end check against the test server
// (services/api: uvicorn tests.e2e_server:app). The browser keeps the kept data in memory only (the phone keeps it in
// sealed files), so this checks the screens while the page stays open: load, cut the server, wait for the next
// reload, see the same data with the offline banner, bring the server back, see the banner go.
// Usage: node tools/e2e/offline.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up o@example.com.
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
    await api('/auth/sign-up', { method: 'POST', body: { email: 'o@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'o@example.com', password: 'correct horse battery' } })).json.access_token;
    // The current Terms, Privacy and AI consent (PM-156), so the read-and-accept screen does not stand in front of the tabs.
    const pending = (await api('/consent', { token: tk })).json;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(pending.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    const langs = process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']];
    // Sensor readings every 5 minutes for the last three hours, the last one 3 minutes ago at 137.
    const now = Date.now();
    for (let i = 36; i >= 0; i--) {
      const at = new Date(now - 3 * 60_000 - i * 5 * 60_000).toISOString();
      await api('/glucose', { method: 'POST', token: tk, body: { idempotency_key: `offline-e2e-${i}`, measured_at: at, entered_at: at, source: 'manual', method: 'sensor', value: i === 0 ? 137 : 110 + (i % 9) * 4, unit: 'mg/dL' } });
    }
    for (const [lang, scheme] of langs) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      page.setDefaultTimeout(8000);
      const he = lang === 'he';
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', ovr: 'סקירה', jrn: 'יומן' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', ovr: 'Overview', jrn: 'Journal' };
      const ANALYSED = he ? /נותח לאחרונה/ : /Last analysed/;
      const OFF = he ? 'אין חיבור ל־Stedio' : 'No connection to Stedio';
      const SAVED = he ? /מוצגים הנתונים שנשמרו בטלפון/ : /Showing what was saved on this phone/;
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('o@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      await shot('00-after-sign-in');
      const tab = async (name) => { await page.getByRole('tab', { name }).first().click().catch(async () => page.getByText(name, { exact: true }).last().click()); await page.waitForTimeout(3000); };
      await tab(L.ovr);
      ok(`${lang} ${scheme}: online, latest reading shown`, (await page.getByText('137', { exact: true }).count()) > 0);
      ok(`${lang} ${scheme}: online, insights analysis shown`, (await page.getByText(ANALYSED).count()) > 0);
      ok(`${lang} ${scheme}: online, no offline banner`, (await page.getByText(OFF, { exact: true }).count()) === 0);
      await shot('01-overview-online');
      await tab(L.jrn);
      await tab(L.ovr);

      // The server can't be reached: every request to it fails like a dropped network.
      await page.route(`${API}/**`, (r) => r.abort('internetdisconnected'));
      // The screens read again on their own each minute.
      await page.waitForTimeout(65_000);
      ok(`${lang} ${scheme}: offline, banner on Overview`, (await page.getByText(OFF, { exact: true }).count()) > 0);
      ok(`${lang} ${scheme}: offline, banner names the kept data`, (await page.getByText(SAVED).count()) > 0);
      ok(`${lang} ${scheme}: offline, latest reading still shown`, (await page.getByText('137', { exact: true }).count()) > 0);
      // Insights clear on a failed read without kept data; with it the last analysis stays.
      ok(`${lang} ${scheme}: offline, last insights analysis still shown`, (await page.getByText(ANALYSED).count()) > 0);
      await shot('02-overview-offline');
      await tab(L.jrn);
      ok(`${lang} ${scheme}: offline, banner on Journal`, (await page.getByText(OFF, { exact: true }).count()) > 0);
      ok(`${lang} ${scheme}: offline, journal still lists readings`, (await page.getByText(/137/).count()) > 0);
      await shot('03-journal-offline');
      // The main screen (the companion's tab, first in the bar).
      await page.getByRole('tab').first().click(); await page.waitForTimeout(3000);
      ok(`${lang} ${scheme}: offline, banner on the main screen`, (await page.getByText(OFF, { exact: true }).count()) > 0);
      ok(`${lang} ${scheme}: offline, main screen reading still shown`, (await page.getByText(/137/).count()) > 0);
      await shot('035-main-offline');
      await page.goto(`${base}/companion`).catch(() => null);
      // A reload of the web page starts with nothing kept (the browser keeps no health data); only check it does not break.
      await page.waitForTimeout(4000);
      await shot('04-companion-after-reload-offline');

      // The server is back: the next answer ends the offline state.
      await page.unroute(`${API}/**`);
      await page.goto(base); await page.waitForTimeout(5000);
      await tab(L.ovr);
      ok(`${lang} ${scheme}: back online, banner gone`, (await page.getByText(OFF, { exact: true }).count()) === 0);
      await shot('05-overview-back-online');
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
