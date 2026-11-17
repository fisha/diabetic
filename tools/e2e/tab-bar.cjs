// Active tab in the tab bar (Guy, 17 Nov 2026: "the relevant tab should be highlighted so a user can tell where he is
// at") end-to-end check against the test server (services/api: uvicorn tests.e2e_server:app).
// Usage: node tools/e2e/tab-bar.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Signs up t@example.com (or signs in when it exists). ONLY=he:dark runs one language and scheme.
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
const TABS = ['companion', 'overview', 'journal', 'profile'];

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 't@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 't@example.com', password: 'correct horse battery' } })).json.access_token;
    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark'], ['en', 'dark']])) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('t@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      // The blocking read-and-accept screen for the test account (once).
      const accept = page.getByText(he ? 'אישור והמשך' : 'Agree and continue', { exact: true });
      if (await accept.count()) { await accept.last().click(); await page.waitForTimeout(3000); }
      if (process.env.DEBUG) await page.screenshot({ path: path.join(out, 'debug.png') });
      // The tab bar is the last tablist on the page (the journal has its own filter tabs above it).
      const bar = () => page.getByRole('tablist').last();
      for (const [i, tab] of TABS.entries()) {
        // Moves by pressing the tab, as a person does.
        const target = bar().getByRole('tab').nth(i);
        await target.click(); await page.waitForTimeout(2500);
        const agree = page.getByText(he ? 'אישור והמשך' : 'Agree and continue', { exact: true });
        if (await agree.count()) { await agree.last().click(); await page.waitForTimeout(2500); await bar().getByRole('tab').nth(i).click(); await page.waitForTimeout(2500); }
        const selected = await bar().getByRole('tab').evaluateAll((els) => els.map((e) => e.getAttribute('aria-selected') === 'true'));
        ok(`${lang} ${scheme} ${tab}: only this tab is selected`, selected.length === 4 && selected.every((s, j) => s === (j === i)), JSON.stringify(selected));
        await page.screenshot({ path: path.join(out, `${lang}-${scheme}-${i + 1}-${tab}.png`) });
        const box = await bar().boundingBox();
        if (box) await page.screenshot({ path: path.join(out, `${lang}-${scheme}-${i + 1}-${tab}-bar.png`), clip: { x: 0, y: box.y - 8, width: 390, height: box.height + 8 } });
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
