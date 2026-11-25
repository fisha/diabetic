// Talk row (PM-522, Guy 25 Nov 2026): the four buttons under "Tap to talk" stay on one line in English and Hebrew,
// from a narrow phone to a Pro Max; when the labels do not fit, short labels (History, Type), and when those do not fit
// either, the icons only.
// Was: Simple mode (PM-450, Guy 23 Nov 2026): a switch on the Settings screen. While on, the tab bar has Talk, Overview and
// Settings (no Journal), the main screen keeps everything but the games button, the "+" keeps every option, and the
// Overview shows the latest reading, the period with time in range, the period's graph (Guy, 24 Nov 2026, PM-476), the
// insights and the set and sensor rows, without the Over time / Averages views. Switching it off brings everything back.
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
    const email = `talkrow-${run}@example.com`;
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
      await api('/glucose', { method: 'POST', token: tk, body: { idempotency_key: `tr-${run}-${i}`, measured_at: new Date(now - (i * 20 + 5) * 60000).toISOString(), entered_at: new Date().toISOString(), source: 'manual', method: 'meter', value: 110 + ((i * 37) % 90), unit: 'mg/dL' } });
    }

    const looks = [['en', 'light', 440], ['en', 'dark', 390], ['en', 'light', 345], ['en', 'dark', 320], ['he', 'light', 440], ['he', 'dark', 390], ['he', 'light', 320]];
    for (const [lang, scheme, width] of looks) {
      const he = lang === 'he';
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const B = he ? ['שיחות', 'כתיבה', 'מצב שקט', 'משחקים'] : ['Conversations', 'Type instead', 'Quiet mode', 'Games'];
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, locale: he ? 'he-IL' : 'en-US', deviceScaleFactor: 2, timezoneId: 'UTC' });
      const p = await ctx.newPage(); lastPage = p; p.on('pageerror', (e) => errors.push(e.message)); p.setDefaultTimeout(6000);
      await p.goto(base); await p.waitForTimeout(2000);
      if (he) { await p.getByText('עברית', { exact: true }).first().click().catch(() => null); await p.waitForTimeout(800); }
      await p.getByText(L.have, { exact: true }).last().click(); await p.waitForTimeout(1500);
      await p.getByLabel(L.email, { exact: true }).fill(email);
      await p.getByLabel(L.pw, { exact: true }).fill(PW);
      await p.getByText(L.go, { exact: true }).last().click(); await p.waitForTimeout(5000);
      const talk = he ? 'שיחה' : 'Talk';
      await p.getByRole('tab', { name: talk }).first().click({ timeout: 3000 }).catch(() => p.getByText(talk, { exact: true }).last().click());
      await p.waitForTimeout(3000);
      const tag = `${lang} ${scheme} ${width}`;
      const boxes = [];
      for (const name of B) {
        const els = p.getByRole('button', { name, exact: true });
        let box = null;
        for (let i = 0; i < (await els.count()); i++) { const b = await els.nth(i).boundingBox(); if (b && b.width > 0) { box = b; break; } }
        boxes.push(box);
        ok(`${tag}: ${name} shown`, !!box);
      }
      const ys = boxes.filter(Boolean).map((b) => Math.round(b.y));
      ok(`${tag}: one row`, ys.length === 4 && Math.max(...ys) - Math.min(...ys) <= 2, ys.join(','));
      ok(`${tag}: inside the screen`, boxes.every((b) => b && b.x >= 0 && b.x + b.width <= width), boxes.map((b) => b && `${Math.round(b.x)}+${Math.round(b.width)}`).join(' '));
      // The visible row only: the hidden measuring copies sit under aria-hidden.
      const first = await p.evaluate((names) => {
        const el = [...document.querySelectorAll('[role=button]')].find((b) => !b.closest('[aria-hidden=true]') && names.includes(b.getAttribute('aria-label')));
        if (!el) return 'missing';
        return el.innerText.trim() || 'icon only';
      }, [B[0]]);
      results.push(`INFO ${tag}: first button ${first}`);
      // Full English labels need about 407 px: short labels on a Pro Max (Guy's screenshot), icons only at 320.
      if (lang === 'en' && width >= 345) ok(`${tag}: short labels`, first === 'History');
      if (lang === 'en' && width === 320) ok(`${tag}: icons only`, first === 'icon only');
      if (lang === 'he' && width >= 390) ok(`${tag}: full labels`, first === B[0]);
      await p.screenshot({ path: path.join(out, `${lang}-${scheme}-${width}.png`) });
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
