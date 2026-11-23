// Admin > App updates (PM-440), against a test API (localhost:8000, STEADY_ADMIN_EMAILS=boss@example.com, Expo's push
// URL pointed at a local stub so nothing reaches the push service) and the website (`next start -p 3000`, built with
// NEXT_PUBLIC_STEADY_API_URL=http://localhost:8000). Usage: node tools/e2e/admin-updates.cjs <screenshot dir> [pushes.jsonl]
// Seeds: he/en people with phones, one with App updates off, one with All notifications off. Profiles' languages
// are set with psql (DATABASE env: a libpq URL of the test database).
const fs = require('fs'); const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require('playwright');
const out = process.argv[2]; const pushes = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000'; const WEB = 'http://localhost:3000';
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const pw = 'correct horse battery';
const person = async (email, locale, token) => {
  await api('/auth/sign-up', { method: 'POST', body: { email, password: pw } });
  const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: pw } })).json.access_token;
  const id = (await api('/auth/me', { token: tk })).json.id;
  execSync(`psql "${process.env.DATABASE}" -qc "insert into profiles (user_id, locale, diabetes_type, glucose_unit, answers) values ('${id}', '${locale}', 'type1', 'mgdl', '{}') on conflict do nothing"`);
  if (token) await api('/devices/push-token', { method: 'PUT', token: tk, body: { token: `ExponentPushToken[${token}]`, platform: 'ios' } });
  return tk;
};
(async () => {
  const browser = await chromium.launch(); const errors = [];
  try {
    await person('he1@example.com', 'he', 'he1');
    await person('en1@example.com', 'en', 'en1');
    const opt = await person('opt@example.com', 'he', 'op1');
    const mute = await person('mute@example.com', 'en', 'mu1');
    await api('/settings', { method: 'PATCH', token: opt, body: { product_updates: false } });
    await api('/settings', { method: 'PATCH', token: mute, body: { notifications_on: false } });
    await api('/auth/sign-up', { method: 'POST', body: { email: 'boss@example.com', password: pw } });
    // The website is English only (16 Nov 2026): the second round is the dark scheme.
    for (const [lang, scheme] of [['en', 'light'], ['en2', 'dark']]) {
      const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: scheme, deviceScaleFactor: 2 });
      const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(8000);
      const L = { email: 'Email', pw: 'Password', go: 'Sign in', nav: 'App updates', send: 'Send to 2 people', go2: 'Send to 2', he: 'Hebrew text', en: 'English text' };
      await page.goto(`${WEB}/en/dashboard`); await page.waitForTimeout(2500);
      await page.getByLabel(L.email, { exact: true }).fill('boss@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill(pw);
      await page.getByRole('button', { name: L.go, exact: true }).click(); await page.waitForTimeout(3000);
      await page.getByRole('link', { name: L.nav, exact: true }).click(); await page.waitForTimeout(2000);
      ok(`${lang}: send disabled without text`, await page.getByRole('button', { name: L.send }).isDisabled());
      await page.getByLabel(L.he).fill(`גרסה חדשה (${lang}): אפשר לשמור ארוחות מועדפות עם תמונה.`);
      await page.getByLabel(L.en).fill(`New version (${lang}): favorite meals can keep a photo.`);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-01-compose.png`), fullPage: true });
      await page.getByRole('button', { name: L.send }).click(); await page.waitForTimeout(500);
      ok(`${lang}: confirm dialog`, (await page.getByRole('alertdialog').count()) === 1);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-02-confirm.png`) });
      await page.getByRole('alertdialog').getByRole('button', { name: L.go2, exact: true }).click(); await page.waitForTimeout(2500);
      // Reloading signs the dashboard out (it keeps nothing), so the list is read again by opening the page again.
      await page.getByRole('link', { name: 'Clinics', exact: true }).click(); await page.waitForTimeout(1000);
      await page.getByRole('link', { name: L.nav, exact: true }).click(); await page.waitForTimeout(2000);
      ok(`${lang}: listed as sent`, (await page.getByText(`New version (${lang})`).count()) > 0);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-03-sent.png`), fullPage: true });
      await ctx.close();
    }
    const boss = (await api('/auth/sign-in', { method: 'POST', body: { email: 'boss@example.com', password: pw } })).json.access_token;
    const list = (await api('/admin/broadcasts', { token: boss })).json;
    ok('two broadcasts, both done', list.sent.length === 2 && list.sent.every((b) => b.status === 'done' && b.sent === 2 && b.withheld === 2 && b.failed === 0), JSON.stringify(list.sent.map((b) => [b.status, b.sent, b.withheld])));
    if (pushes) {
      const msgs = fs.readFileSync(pushes, 'utf8').trim().split('\n').flatMap((l) => JSON.parse(l));
      const he = msgs.filter((m) => m.to === 'ExponentPushToken[he1]'); const en = msgs.filter((m) => m.to === 'ExponentPushToken[en1]');
      ok('Hebrew person got Hebrew, English person English', he.length === 2 && en.length === 2 && he.every((m) => m.body.startsWith('גרסה')) && en.every((m) => m.body.startsWith('New')));
      ok('opted out and all off got nothing', !msgs.some((m) => /op1|mu1/.test(m.to)));
    }
  } catch (e) { ok('no exception', false, e.stack); }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n')); await browser.close();
})();
