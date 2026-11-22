// Pinch-to-zoom on the Overview day graph (PM-417), end-to-end against the test server (services/api: uvicorn
// tests.e2e_server:app on port 8000) with touch input. The account gets simulated sensor days from the forecast seed
// (test fixtures only). Checks, in English and Hebrew: a two-finger pinch narrows the time labels under the plot, a
// one-finger sideways drag moves them, a double tap shows the whole day again, and an unzoomed vertical drag still
// scrolls the page.
// Usage: SEED="uv run --directory services/api python tests/e2e_forecast_seed.py" node tools/e2e/graph-zoom.cjs <web export> <screenshot dir>
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

/** The plot's box and the time labels under it, left to right. */
async function graph(page) {
  return page.evaluate(() => {
    const img = [...document.querySelectorAll('[role="img"]')].find((e) => /^(Glucose graph with|גרף גלוקוז עם)/.test(e.getAttribute('aria-label') || ''));
    if (!img) return null;
    const box = img.getBoundingClientRect();
    const labels = [...document.querySelectorAll('div')]
      .filter((e) => e.children.length === 0 && /^\d{1,2}:\d{2}$/.test(e.textContent.trim()))
      .map((e) => ({ t: e.textContent.trim(), r: e.getBoundingClientRect() }))
      .filter((l) => l.r.top > box.bottom - 4 && l.r.top < box.bottom + 70)
      .sort((a, b) => a.r.left - b.r.left)
      .map((l) => l.t);
    return { x: box.left, y: box.top, w: box.width, h: box.height, labels };
  });
}

const touch = (cdp, type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
async function pinch(cdp, g, from, to) {
  const cy = g.y + g.h / 2; const cx = g.x + g.w / 2;
  await touch(cdp, 'touchStart', [[cx - from, cy]]);
  await touch(cdp, 'touchStart', [[cx - from, cy], [cx + from, cy]]);
  for (let i = 1; i <= 10; i++) {
    const d = from + ((to - from) * i) / 10;
    await touch(cdp, 'touchMove', [[cx - d, cy], [cx + d, cy]]);
    await new Promise((r) => setTimeout(r, 16));
  }
  await touch(cdp, 'touchEnd', []);
}
async function drag(cdp, x0, y0, dx, dy) {
  await touch(cdp, 'touchStart', [[x0, y0]]);
  for (let i = 1; i <= 10; i++) { await touch(cdp, 'touchMove', [[x0 + (dx * i) / 10, y0 + (dy * i) / 10]]); await new Promise((r) => setTimeout(r, 16)); }
  await touch(cdp, 'touchEnd', []);
}
async function tap(cdp, x, y) { await touch(cdp, 'touchStart', [[x, y]]); await touch(cdp, 'touchEnd', []); }
const mins = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const span = (l) => { let d = mins(l[l.length - 1]) - mins(l[0]); if (d <= 0) d += 1440; return d; };

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
    if (process.env.SEED) execSync(`${process.env.SEED} owner@example.com`, { stdio: 'inherit' });
    for (const [lang, scheme] of [['en', 'light'], ['he', 'dark']]) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', timezoneId: TZ, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
      const page = await ctx.newPage(); global.lastPage = page;
      page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (process.env.DBG && m.text().startsWith('ZDBG')) console.log(m.text()); });
      page.setDefaultTimeout(8000);
      const cdp = await ctx.newCDPSession(page);
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      const he = lang === 'he';
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', tab: 'סקירה' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', tab: 'Overview' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('owner@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await page.getByRole('tab', { name: L.tab, exact: true }).click(); await page.waitForTimeout(4000);
      const later = page.getByText(he ? 'אחר כך' : 'Later', { exact: true });
      if (await later.isVisible().catch(() => false)) { await later.click(); await page.waitForTimeout(1000); }
      await page.locator('[role="img"][aria-label^="' + (he ? 'גרף גלוקוז' : 'Glucose graph') + '"]').first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      const g0 = await graph(page);
      await shot('01-whole-day');
      ok(`${lang} the graph shows five time labels over the day`, g0 && g0.labels.length === 5 && span(g0.labels) >= 1380, g0 && g0.labels.join(' '));

      await pinch(cdp, g0, 30, 120); await page.waitForTimeout(600);
      const g1 = await graph(page);
      await shot('02-pinched');
      ok(`${lang} a pinch zooms in (labels span less time)`, g1.labels.length === 5 && span(g1.labels) < span(g0.labels) / 2, g1.labels.join(' '));

      await drag(cdp, g1.x + g1.w / 2, g1.y + g1.h / 2, 120, 0); await page.waitForTimeout(600);
      const g2 = await graph(page);
      await shot('03-dragged');
      ok(`${lang} a sideways drag shows an earlier part of the day`, mins(g2.labels[0]) < mins(g1.labels[0]) && span(g2.labels) === span(g1.labels), g2.labels.join(' '));

      await tap(cdp, g2.x + 40, g2.y + 40); await page.waitForTimeout(120); await tap(cdp, g2.x + 40, g2.y + 40); await page.waitForTimeout(600);
      const g3 = await graph(page);
      await shot('04-double-tap');
      ok(`${lang} a double tap shows the whole day again`, g3.labels.join() === g0.labels.join(), g3.labels.join(' '));

      // Unzoomed, a vertical drag on the graph still scrolls the page.
      const before = g3.y;
      await drag(cdp, g3.x + g3.w / 2, g3.y + g3.h / 2, 0, -200); await page.waitForTimeout(800);
      const g4 = await graph(page);
      ok(`${lang} a vertical drag on the graph scrolls the page`, g4.y < before - 50, `${Math.round(before)} -> ${Math.round(g4.y)}`);
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
