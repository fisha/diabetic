// "Who are you here for?" at sign-up (DAP-7, 16 Nov 2026) end-to-end check against the test server
// (services/api: uvicorn tests.e2e_server:app).
// Usage: node tools/e2e/persona.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up p-<lang>-<scheme>@example.com for each run.
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

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8091, async () => {
  const base = 'http://localhost:8091';
  const browser = await chromium.launch();
  const errors = [];
  try {
    for (const [lang, scheme] of [['en', 'light'], ['he', 'light'], ['he', 'dark']]) {
      const email = `p-${lang}-${scheme}@example.com`; const pw = 'correct horse battery';
      await api('/auth/sign-up', { method: 'POST', body: { email, password: pw } });
      const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: pw } })).json.access_token;
      ok(`${lang} ${scheme}: new account has no answer`, (await api('/auth/me', { token: tk })).json.persona === null);
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      const L = he
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', q: 'בשביל מי אתם כאן?', child: 'בשביל הילד או הילדה שלי', self: 'בשביל עצמי', cont: 'המשך', saved: 'תודה, שמרנו את התשובה', change: 'שינוי התשובה' }
        : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', q: 'Who are you here for?', child: 'For my child', self: 'For myself', cont: 'Continue', saved: 'Thanks, we saved your answer', change: 'Change my answer' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill(email);
      await page.getByLabel(L.pw, { exact: true }).fill(pw);
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(3000);
      ok(`${lang} ${scheme}: asked who they are here for`, (await page.getByText(L.q, { exact: true }).count()) > 0);
      await shot('01-question');
      await page.getByText(L.child, { exact: true }).first().click(); await page.waitForTimeout(300);
      await shot('02-chosen');
      await page.getByText(L.cont, { exact: true }).last().click(); await page.waitForTimeout(2000);
      ok(`${lang} ${scheme}: not-ready note`, (await page.getByText(L.saved, { exact: true }).count()) > 0);
      ok(`${lang} ${scheme}: child kept`, (await api('/auth/me', { token: tk })).json.persona === 'child');
      await shot('03-not-ready');
      // Reopening the app keeps the note, not the setup.
      await page.goto(base); await page.waitForTimeout(2500);
      ok(`${lang} ${scheme}: note again after reopening`, (await page.getByText(L.saved, { exact: true }).count()) > 0);
      await page.getByText(L.change, { exact: true }).last().click(); await page.waitForTimeout(800);
      await page.getByText(L.self, { exact: true }).first().click(); await page.waitForTimeout(300);
      await page.getByText(L.cont, { exact: true }).last().click(); await page.waitForTimeout(2500);
      ok(`${lang} ${scheme}: self kept`, (await api('/auth/me', { token: tk })).json.persona === 'self');
      ok(`${lang} ${scheme}: self goes on to setup`, /onboarding/.test(page.url()), page.url());
      await shot('04-setup');
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
