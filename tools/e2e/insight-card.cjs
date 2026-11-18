// Superseded on 18 Nov 2026 (PM-238): the insight cards left the box under the character for the top of the screen,
// checked by tools/e2e/main-top.cjs. Kept for history; it fails against builds from PM-238 on.
// The insight card under the companion shows whole (PM-210, Guy 17 Nov 2026), end-to-end check against the test server
// (services/api: uvicorn tests.e2e_server:app). Synthetic readings for this check only.
// Usage: node tools/e2e/insight-card.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up i@example.com.
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
const SIZES = { small: { width: 375, height: 667 }, large: { width: 440, height: 956 } };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'i@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'i@example.com', password: 'correct horse battery' } })).json.access_token;
    // Four days at this hour above the range, and one reading today: an insight about this time of day.
    for (let i = 1; i <= 4; i++) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(new Date().getHours(), 0, 0, 0);
      await api('/glucose', { method: 'POST', token: tk, body: { idempotency_key: `ic-e2e-${i}`, measured_at: d.toISOString(), entered_at: d.toISOString(), source: 'manual', method: 'meter', value: 200 + i, unit: 'mg/dL' } });
    }
    const today = new Date(Date.now() - 10 * 60_000);
    await api('/glucose', { method: 'POST', token: tk, body: { idempotency_key: 'ic-e2e-today', measured_at: today.toISOString(), entered_at: today.toISOString(), source: 'manual', method: 'meter', value: 121, unit: 'mg/dL' } });
    for (const [lang, scheme, size] of [['en', 'light', 'large'], ['en', 'light', 'small'], ['he', 'light', 'large'], ['he', 'dark', 'small'], ['en', 'dark', 'large']]) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: SIZES[size], colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('i@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      await page.goto(`${base}/companion`); await page.waitForTimeout(4000);
      const agree = page.getByText(he ? 'אישור והמשך' : 'Agree and continue', { exact: true });
      if (await agree.count()) { await agree.last().click(); await page.waitForTimeout(3000); await page.goto(`${base}/companion`); await page.waitForTimeout(4000); }
      await page.waitForTimeout(3000);
      // The card's first line (its title) must be inside the visible part of the box it scrolls in.
      const talk = page.getByText(he ? 'לדבר על זה' : 'Talk about this', { exact: true }).first();
      const has = (await talk.count()) > 0;
      let whole = false;
      if (has) {
        whole = await talk.evaluate((el) => {
          let bubble = el; for (let i = 0; i < 12 && bubble; i++) { bubble = bubble.parentElement; if (bubble && getComputedStyle(bubble).borderTopLeftRadius === '16px') break; }
          let box = bubble?.parentElement; while (box && !(getComputedStyle(box).overflowY === 'auto' || getComputedStyle(box).overflowY === 'scroll')) box = box.parentElement;
          if (!bubble || !box) return false;
          const b = bubble.getBoundingClientRect(); const s = box.getBoundingClientRect();
          return b.top >= s.top - 1;
        });
      }
      ok(`${lang} ${scheme} ${size}: insight card shown`, has);
      ok(`${lang} ${scheme} ${size}: card shown from its top`, whole);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-${size}-main.png`) });
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
