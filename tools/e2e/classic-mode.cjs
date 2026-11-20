// Classic Stedio (Guy, 16 Nov 2026: "release me from the games") end-to-end check against the test server
// (services/api: uvicorn tests.e2e_server:app).
// Usage: node tools/e2e/classic-mode.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up c@example.com.
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
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '80-140' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm', accessories: { hat: 'party', glasses: 'round' } }, checkIns: { frequency: 'moreAtFirst' } };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'c@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'c@example.com', password: 'correct horse battery' } })).json.access_token;
    const companion = async () => (await api('/profile', { token: tk })).json?.answers?.companion ?? {};
    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']])) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const T = he ? { classic: 'Stedio קלאסי', acc: 'אקססוריז' } : { classic: 'Classic Stedio', acc: 'Accessories' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('c@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      await shot('00-after-sign-in');
      await page.goto(`${base}/settings/companion`); await page.waitForTimeout(3500);
      await shot('01-off');
      await page.goto(`${base}/settings/privacy`); await page.waitForTimeout(2500);
      await shot('00b-other-switches');
      await page.goto(`${base}/settings/companion`); await page.waitForTimeout(3000);
      const sw = page.getByRole('switch', { name: T.classic }).first();
      ok(`${lang} ${scheme}: switch at the top, off`, (await sw.count()) > 0 && (await sw.getAttribute('aria-checked')) !== 'true');
      ok(`${lang} ${scheme}: accessories shown while off`, (await page.getByText(T.acc, { exact: true }).count()) > 0);
      await sw.click(); await page.waitForTimeout(2500);
      await shot('02-on');
      let c = await companion();
      ok(`${lang} ${scheme}: saved on the server`, c.classic === true, JSON.stringify({ classic: c.classic }));
      ok(`${lang} ${scheme}: chosen accessories kept`, c.accessories?.hat === 'party');
      ok(`${lang} ${scheme}: accessories hidden while on`, (await page.getByText(T.acc, { exact: true }).count()) === 0);
      await page.goto(`${base}/companion`); await page.waitForTimeout(4000);
      // The AI consent asked before the companion (test account only).
      const agree = page.getByText(he ? 'אישור והמשך' : 'Agree and continue', { exact: true });
      if (await agree.count()) { await agree.last().click(); await page.waitForTimeout(3000); await page.goto(`${base}/companion`); await page.waitForTimeout(4000); }
      await shot('03-companion-classic');
      if (lang === 'en') {
        await page.goto(`${base}/settings/companion`); await page.waitForTimeout(3500);
        await page.getByRole('switch', { name: T.classic }).first().click(); await page.waitForTimeout(2500);
        c = await companion();
        ok('turned off again: saved', c.classic === false);
        ok('turned off again: accessories back', (await page.getByText(T.acc, { exact: true }).count()) > 0);
        // PM-321: they open right under the Classic card, not below the WhatsApp or other cards.
        const sb = await page.getByRole('switch', { name: T.classic }).first().boundingBox();
        const ab = await page.getByText(T.acc, { exact: true }).first().boundingBox();
        ok('turned off again: accessories right under Classic', !!sb && !!ab && ab.y > sb.y && ab.y - (sb.y + sb.height) < 120, sb && ab ? `${Math.round(ab.y - sb.y - sb.height)} px` : 'missing');
        await shot('04-off-again');
      }
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
