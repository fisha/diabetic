// Simple mode (PM-450, Guy 23 Nov 2026): a switch on the Settings screen. While on, the tab bar has Talk, Overview and
// Settings (no Journal), the main screen keeps everything but the games button, the "+" keeps every option, and the
// Overview shows the latest reading, the period with time in range, the Insights row and the set and sensor rows, with
// no graph. Switching it off brings everything back.
// Usage: node tools/e2e/simple-mode.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000 and EXPO_PUBLIC_WEBSITE_URL=http://localhost:8090> <screenshot dir>
// Against the test server (services/api: uvicorn tests.e2e_server:app) with STEADY_CORS_ORIGINS=["http://localhost:8090"],
// STEADY_ALLOW_EMAIL_SIGN_UP=true, STEADY_REQUIRE_EMAIL_VERIFICATION=false, STEADY_REQUIRE_APPROVAL=false.
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
const ANSWERS = { version: 1, infusionSet: 'standard', consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '70-180' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Stedio', style: 'warm', callMe: 'Dana' }, checkIns: { frequency: 'moreAtFirst' } };
const PW = 'correct horse battery';
const run = Date.now().toString(36);
let lastPage = null;

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    const email = `simple-${run}@example.com`;
    await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
    const docs = (await api('/consent', { token: tk })).json;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
    const cl = await api('/devices/carelink', { method: 'PUT', token: tk, body: { username: 'simple_cl', password: 'pump-pass' } });
    ok('connects CareLink', cl.status === 200, String(cl.status));
    await api('/settings', { method: 'PATCH', token: tk, body: { timezone: 'UTC' } });
    await api('/devices/set-change', { method: 'POST', token: tk, body: { at: new Date(Date.now() - 86400000).toISOString() } });
    const now = Date.now();
    for (let i = 0; i < 36; i++) {
      await api('/glucose', { method: 'POST', token: tk, body: { idempotency_key: `sm-${run}-${i}`, measured_at: new Date(now - (i * 20 + 5) * 60000).toISOString(), entered_at: new Date().toISOString(), source: 'manual', method: 'meter', value: 110 + ((i * 37) % 90), unit: 'mg/dL' } });
    }

    const looks = [['en', 'light'], ['he', 'light'], ['he', 'dark']];
    for (const [lang, scheme] of looks) {
      const he = lang === 'he';
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const T = he
        ? { talk: 'שיחה', overview: 'סקירה', journal: 'יומן', settings: 'הגדרות', simple: 'מצב פשוט', overTime: 'לאורך הזמן', tir: 'זמן בטווח', set: 'סט עירוי', games: 'משחקים', plus: 'תיעוד מהיר' }
        : { talk: 'Talk', overview: 'Overview', journal: 'Journal', settings: 'Settings', simple: 'Simple mode', overTime: 'Over time', tir: 'Time in range', set: 'Infusion set', games: 'Games', plus: 'Quick log' };
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: he ? 'he-IL' : 'en-US', deviceScaleFactor: 2, timezoneId: 'UTC' });
      const p = await ctx.newPage(); lastPage = p; p.on('pageerror', (e) => errors.push(e.message)); p.setDefaultTimeout(6000);
      const has = async (s) => (await p.getByText(s, { exact: true }).count()) > 0;
      const tab = (name) => p.getByRole('tab', { name }).first().click({ timeout: 3000 }).catch(() => p.getByText(name, { exact: true }).last().click());
      await p.goto(base); await p.waitForTimeout(2000);
      if (he) { await p.getByText('עברית', { exact: true }).first().click().catch(() => null); await p.waitForTimeout(800); }
      await p.getByText(L.have, { exact: true }).last().click(); await p.waitForTimeout(1500);
      await p.getByLabel(L.email, { exact: true }).fill(email);
      await p.getByLabel(L.pw, { exact: true }).fill(PW);
      await p.getByText(L.go, { exact: true }).last().click(); await p.waitForTimeout(4000);
      const shot = (n) => p.screenshot({ path: path.join(out, `${lang}-${scheme}-${n}.png`) });
      if (lang === 'en') {
        ok('off: Journal tab shown', await has(T.journal));
        await tab(T.overview); await p.waitForTimeout(2500);
        ok('off: Overview has the graph views', await has(T.overTime));
      }
      // The switch on the Settings screen.
      await tab(T.settings); await p.waitForTimeout(1500);
      const sw = p.getByRole('switch', { name: T.simple });
      await sw.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
      await sw.click(); await p.waitForTimeout(1500);
      await shot('01-settings-on');
      ok(`${lang} ${scheme}: Journal tab hidden`, !(await has(T.journal)));
      const saved = (await api('/profile', { token: tk })).json;
      ok(`${lang} ${scheme}: saved with the profile`, saved?.answers?.companion?.simple === true);
      await tab(T.talk); await p.waitForTimeout(2500);
      await shot('02-home');
      ok(`${lang} ${scheme}: no games button on the main screen`, !(await has(T.games)));
      await p.getByLabel(T.plus, { exact: true }).first().click(); await p.waitForTimeout(1500);
      await shot('03-plus');
      await p.keyboard.press('Escape'); await p.goBack().catch(() => null); await p.waitForTimeout(1200);
      await tab(T.overview); await p.waitForTimeout(3000);
      await shot('04-overview');
      ok(`${lang} ${scheme}: Overview has time in range`, await has(T.tir));
      ok(`${lang} ${scheme}: Overview has no graph`, !(await has(T.overTime)));
      ok(`${lang} ${scheme}: Overview has the set row`, await has(T.set));
      // Off again: everything comes back.
      await tab(T.settings); await p.waitForTimeout(1200);
      await p.getByRole('switch', { name: T.simple }).click(); await p.waitForTimeout(1500);
      ok(`${lang} ${scheme}: off again, Journal back`, await has(T.journal));
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
    if (lastPage) await lastPage.screenshot({ path: path.join(out, 'zz-failure.png') }).catch(() => null);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
