// Under 18 with a parent following (PM-248, Guy 18 Nov 2026) end-to-end check against the test server
// (services/api: uvicorn tests.e2e_server:app). Usage: node tools/e2e/minors.cjs <web export built with
// EXPO_PUBLIC_API_URL=http://localhost:8000 and EXPO_PUBLIC_WEBSITE_URL=http://localhost:8090> <screenshot dir>
// Start from an empty database: it signs up kid-*@example.com and parent-*@example.com for each language and theme.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const PW = 'correct horse battery';
const account = async (email, persona = 'self') => {
  await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
  const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
  await api('/auth/persona', { method: 'PUT', token: tk, body: { persona } });
  return tk;
};

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    for (const [lang, scheme] of [['en', 'light'], ['he', 'light'], ['he', 'dark']]) {
      const he = lang === 'he';
      const tag = `${lang}-${scheme}`;
      const kidEmail = `kid-${tag}@example.com`; const parentEmail = `parent-${tag}@example.com`;
      const kid = await account(kidEmail);
      const L = he
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', d: 'יום', m: 'חודש', y: 'שנה', cont: 'המשך', invite: 'יצירת ההזמנה', check: 'ההורה שלי אישר, להמשיך', gd: 'לאשר ולעקוב', units: 'באילו יחידות גלוקוז משתמשים אצלך?' }
        : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', d: 'Day', m: 'Month', y: 'Year', cont: 'Continue', invite: 'Create the invite', check: 'My parent accepted, continue', gd: 'Confirm and follow', units: 'Which glucose units do you use?' };
      const ctxFor = () => browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: he ? 'he-IL' : 'en-US', deviceScaleFactor: 2 });
      const signIn = async (page, email, from = base) => {
        await page.goto(from); await page.waitForTimeout(2000);
        if (he) { await page.getByText('עברית', { exact: true }).first().click().catch(() => null); await page.waitForTimeout(800); }
        await page.getByText(L.have, { exact: true }).last().click().catch(() => page.getByText(L.go, { exact: true }).last().click()); await page.waitForTimeout(1500);
        await page.getByLabel(L.email, { exact: true }).fill(email);
        await page.getByLabel(L.pw, { exact: true }).fill(PW);
        await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      };

      // The kid signs in and enters a date of birth 15 years ago.
      const c1 = await ctxFor(); const p1 = await c1.newPage(); p1.on('pageerror', (e) => errors.push(e.message)); p1.setDefaultTimeout(6000);
      const shot1 = (name) => p1.screenshot({ path: path.join(out, `${tag}-${name}.png`) });
      await signIn(p1, kidEmail);
      await p1.goto(`${base}/onboarding/birth`); await p1.waitForTimeout(2500);
      const y = String(new Date().getFullYear() - 15);
      await p1.getByLabel(L.d, { exact: true }).fill('3'); await p1.getByLabel(L.m, { exact: true }).fill('4'); await p1.getByLabel(L.y, { exact: true }).fill(y);
      await p1.getByText(L.cont, { exact: true }).last().click(); await p1.waitForTimeout(3000);
      await shot1('01-invite-a-parent');
      let me = (await api('/auth/me', { token: kid })).json;
      ok(`${tag}: server knows the kid is under 18 and needs a parent`, me.minor === true && me.guardian_needed === true);
      ok(`${tag}: nothing else answers yet`, (await api('/settings', { token: kid })).json?.detail === 'guardian_required');
      await p1.getByText(L.invite, { exact: true }).last().click(); await p1.waitForTimeout(2500);
      await shot1('02-invite-code');
      const inv = (await api('/sharing', { token: kid })).json.viewers.find((v) => v.guardian && !v.accepted_at);
      ok(`${tag}: a parent invite exists`, !!inv?.code);
      await p1.getByText(L.check, { exact: true }).last().click(); await p1.waitForTimeout(2000);
      await shot1('03-not-yet');
      ok(`${tag}: still on the invite before the parent confirms`, (await p1.getByText(L.check, { exact: true }).count()) > 0);

      // The parent opens the link, signs in, must tick the confirmation, then follows.
      await account(parentEmail, 'family');
      const c2 = await ctxFor(); const p2 = await c2.newPage(); p2.on('pageerror', (e) => errors.push(e.message)); p2.setDefaultTimeout(6000);
      const shot2 = (name) => p2.screenshot({ path: path.join(out, `${tag}-${name}.png`) });
      await p2.goto(`${base}/share?code=${inv.code}`); await p2.waitForTimeout(2500);
      if (he) { await p2.getByText('עברית', { exact: true }).first().click().catch(() => null); await p2.waitForTimeout(500); }
      await p2.getByText(L.go, { exact: true }).last().click(); await p2.waitForTimeout(1500);
      await p2.getByLabel(L.email, { exact: true }).fill(parentEmail);
      await p2.getByLabel(L.pw, { exact: true }).fill(PW);
      await p2.getByText(L.go, { exact: true }).last().click(); await p2.waitForTimeout(4000);
      await shot2('04-parent-confirm');
      await p2.getByText(L.gd, { exact: true }).last().click(); await p2.waitForTimeout(1200);
      await shot2('05-parent-must-tick');
      ok(`${tag}: not followed without the tick`, (await api('/auth/me', { token: kid })).json.guardian_needed === true);
      await p2.getByRole('checkbox').first().click().catch(() => p2.getByText(he ? /אני ההורה או האפוטרופוס/ : /I am .* parent or legal guardian/).first().click());
      await p2.waitForTimeout(500);
      await p2.getByText(L.gd, { exact: true }).last().click(); await p2.waitForTimeout(4500);
      await shot2('06-parent-viewing');
      me = (await api('/auth/me', { token: kid })).json;
      ok(`${tag}: the parent follows as confirmed parent`, me.guardian_needed === false);

      // The kid goes on to the next onboarding step.
      await p1.getByText(L.check, { exact: true }).last().click(); await p1.waitForTimeout(3000);
      await shot1('07-kid-continues');
      ok(`${tag}: kid goes on to the units step`, (await p1.getByText(L.units).count()) > 0);
      await c1.close(); await c2.close();
    }
  } catch (e) {
    results.push(`FAIL exception — ${e.message.split('\n')[0]}`);
  } finally {
    await browser.close(); server.close();
    ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    console.log(results.join('\n'));
  }
});
