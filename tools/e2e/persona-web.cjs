// "Who are you here for?" on the website (DAP-7, 16 Nov 2026), against the test API (localhost:8000, CORS for
// localhost:3000) and the website running with `next start -p 3000` (built with NEXT_PUBLIC_STEADY_API_URL=http://localhost:8000).
// Usage: node tools/e2e/persona-web.cjs <screenshot dir>. It signs up pw-<lang>@example.com.
const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000'; const WEB = 'http://localhost:3000';
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
(async () => {
  const browser = await chromium.launch(); const errors = [];
  try {
    for (const [lang, scheme] of [['en', 'light'], ['he', 'dark']]) {
      const email = `pw-${lang}@example.com`; const pw = 'correct horse battery';
      await api('/auth/sign-up', { method: 'POST', body: { email, password: pw } });
      const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: pw } })).json.access_token;
      const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: scheme, deviceScaleFactor: 2 });
      const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(8000);
      const he = lang === 'he';
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', q: 'בשביל מי אתם כאן?', fam: 'בשביל מישהו קרוב אליי', self: 'בשביל עצמי', cont: 'המשך', saved: 'תודה, שמרנו את התשובה', change: 'שינוי התשובה' }
        : { email: 'Email', pw: 'Password', go: 'Sign in', q: 'Who are you here for?', fam: 'For someone close to me', self: 'For myself', cont: 'Continue', saved: 'Thanks, we saved your answer', change: 'Change my answer' };
      await page.goto(`${WEB}/${lang}/dashboard`); await page.waitForTimeout(2500);
      await page.getByLabel(L.email, { exact: true }).fill(email);
      await page.getByLabel(L.pw, { exact: true }).fill(pw);
      await page.getByRole('button', { name: L.go, exact: true }).click(); await page.waitForTimeout(3000);
      ok(`${lang}: asked`, (await page.getByText(L.q, { exact: true }).count()) > 0);
      await page.getByRole('radio', { name: new RegExp(L.fam) }).click();
      await page.screenshot({ path: path.join(out, `web-${lang}-${scheme}-01-question.png`) });
      await page.getByRole('button', { name: L.cont, exact: true }).click(); await page.waitForTimeout(2000);
      ok(`${lang}: note`, (await page.getByText(L.saved, { exact: true }).count()) > 0);
      ok(`${lang}: family kept`, (await api('/auth/me', { token: tk })).json.persona === 'family');
      await page.screenshot({ path: path.join(out, `web-${lang}-${scheme}-02-not-ready.png`) });
      await page.getByRole('button', { name: L.change, exact: true }).click(); await page.waitForTimeout(500);
      await page.getByRole('radio', { name: new RegExp(L.self) }).first().click();
      await page.getByRole('button', { name: L.cont, exact: true }).click(); await page.waitForTimeout(3000);
      ok(`${lang}: self kept and question gone`, (await api('/auth/me', { token: tk })).json.persona === 'self' && (await page.getByText(L.q, { exact: true }).count()) === 0);
      await page.screenshot({ path: path.join(out, `web-${lang}-${scheme}-03-after-self.png`) });
      await ctx.close();
    }
  } catch (e) { ok('no exception', false, e.stack); }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n')); await browser.close();
})();
