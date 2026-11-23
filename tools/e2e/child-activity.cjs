// A parent sees their child's app use (PM-444, Guy 23 Nov 2026): on Settings while viewing the child, a row with the
// child's last activity opens counts for 7 or 30 days: entries the child logged, talks with the mentor, games played.
// Counts and a time only. Another follower (not the confirmed parent) has no row.
// Usage: node tools/e2e/child-activity.cjs <web export (EXPO_PUBLIC_API_URL=http://localhost:8000)> <screenshot dir>
// Needs the test server (services/api: uvicorn tests.e2e_server:app) with email sign-up open.
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
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '70-180' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Stedio', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };
const PW = 'correct horse battery';
const run = Date.now().toString(36);
const d = new Date(); const birth = { day: String(d.getDate()), month: String(d.getMonth() + 1), year: String(d.getFullYear() - 11) };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    const consent = async (tk) => {
      const docs = (await api('/consent', { token: tk })).json;
      await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((x) => [x.kind, x.version])), at: new Date().toISOString() } });
      await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
    };
    const signUp = async (email) => {
      await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
      return (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
    };
    const kidMail = `ca-kid-${run}@example.com`; const momMail = `ca-mom-${run}@example.com`; const auntMail = `ca-aunt-${run}@example.com`;
    const kid = await signUp(kidMail); const mom = await signUp(momMail); const aunt = await signUp(auntMail);
    await consent(kid); await consent(mom); await consent(aunt);
    await api('/auth/birth', { method: 'PUT', token: kid, body: { birth } });
    const inv = (await api('/sharing/invites', { method: 'POST', token: kid, body: { scopes: ['glucose', 'insights', 'journal'], consent: true, relation: 'mom', guardian: true } })).json;
    await api('/sharing/accept', { method: 'POST', token: mom, body: { code: inv.code, guardian_confirm: true } });
    const inv2 = (await api('/sharing/invites', { method: 'POST', token: kid, body: { scopes: ['glucose'], consent: true, relation: 'family' } })).json;
    await api('/sharing/accept', { method: 'POST', token: aunt, body: { code: inv2.code } });
    await api('/profile', { method: 'PUT', token: kid, body: { locale: 'en', answers: { ...ANSWERS, ageGate: 'under18', birth, companion: { ...ANSWERS.companion, callMe: 'Noam' } } } });
    await api('/profile', { method: 'PUT', token: mom, body: { locale: 'en', answers: { ...ANSWERS, companion: { ...ANSWERS.companion, callMe: 'Dana' } } } });
    await api('/profile', { method: 'PUT', token: aunt, body: { locale: 'en', answers: { ...ANSWERS, companion: { ...ANSWERS.companion, callMe: 'Rina' } } } });

    // What the child does in the app, through the same API the app uses.
    const now = Date.now(); const iso = (minAgo) => new Date(now - minAgo * 60000).toISOString();
    const meal = (k, m) => api('/records', { method: 'POST', token: kid, body: { idempotency_key: `ca-${run}-${k}`, kind: 'meal', occurred_at: iso(m), entered_at: iso(m), source: 'manual', data: { items: [{ name: 'Pita', unit: 'g', qty: 100, carbs_g: 50, prov: 'est' }], ate: 'all', carbs_total_g: 50, any_unknown: false } } });
    ok('meals logged', (await meal('m1', 300)).status < 300 && (await meal('m2', 60)).status < 300);
    ok('insulin logged', (await api('/records', { method: 'POST', token: kid, body: { idempotency_key: `ca-${run}-i1`, kind: 'insulin', occurred_at: iso(55), entered_at: iso(55), source: 'manual', data: { insulin: 'Rapid', units: 3 } } })).status < 300);
    ok('glucose logged', (await api('/glucose', { method: 'POST', token: kid, body: { idempotency_key: `ca-${run}-g1`, measured_at: iso(50), entered_at: iso(50), source: 'manual', method: 'meter', value: 131, unit: 'mg/dL' } })).status < 300);
    ok('message sent', (await api('/conversation/messages', { method: 'POST', token: kid, body: { client_id: `ca-${run}-1`, text: 'I had pita for lunch' } })).status < 300);
    for (const [g, p] of [['runner', 30], ['runner', 20], ['bricks', 40], ['maze', 10]]) await api('/games/score', { method: 'POST', token: kid, body: { game: g, points: p } });

    const share = (await api('/sharing', { token: mom })).json.viewing[0].id;
    const a = (await api(`/sharing/${share}/young/activity`, { token: mom })).json;
    ok('API counts', a && a.logged.meal === 2 && a.logged.insulin === 1 && a.logged.glucose === 1 && a.messages === 1 && a.games.length === 3, JSON.stringify(a));
    const auntShare = (await api('/sharing', { token: aunt })).json.viewing[0].id;
    ok('another follower is refused', (await api(`/sharing/${auntShare}/young/activity`, { token: aunt })).status === 404);

    const signIn = async (page, email, he) => {
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click().catch(() => null); await page.waitForTimeout(800); }
      await page.getByText(he ? 'כבר יש לי חשבון' : 'I already have an account', { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(he ? 'אימייל' : 'Email', { exact: true }).fill(email);
      await page.getByLabel(he ? 'סיסמה' : 'Password', { exact: true }).fill(PW);
      await page.getByText(he ? 'כניסה' : 'Sign in', { exact: true }).last().click(); await page.waitForTimeout(4500);
    };
    const viewNoamSettings = async (page, he) => {
      await page.getByText(he ? 'החלפה' : 'Switch', { exact: true }).first().click(); await page.waitForTimeout(1000);
      await page.getByText('Noam', { exact: true }).last().click(); await page.waitForTimeout(3500);
      const s = he ? 'הגדרות' : 'Settings';
      await page.getByRole('tab', { name: s }).first().click({ timeout: 3000 }).catch(() => page.getByText(s, { exact: true }).last().click());
      await page.waitForTimeout(3000);
    };

    for (const [lang, scheme] of [['en', 'light'], ['en', 'dark'], ['he', 'light'], ['he', 'dark']]) {
      const he = lang === 'he';
      for (const tk of [kid, mom, aunt]) {
        const prof = (await api('/profile', { token: tk })).json;
        await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: prof.answers } });
      }
      const shot = (page, name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`), fullPage: true });
      const c1 = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: he ? 'he-IL' : 'en-US', deviceScaleFactor: 2 });
      const p1 = await c1.newPage(); p1.on('pageerror', (e) => errors.push(e.message)); p1.setDefaultTimeout(6000);
      await signIn(p1, momMail, he);
      await viewNoamSettings(p1, he);
      const row = p1.getByText(he ? 'השימוש של Noam באפליקציה' : "Noam's app use", { exact: true }).first();
      ok(`${lang}-${scheme} row on viewer Settings`, await row.isVisible().catch(() => false));
      ok(`${lang}-${scheme} last activity under the row`, await p1.getByText(he ? /פעילות אחרונה: היום/ : /Last activity: today/).first().isVisible().catch(() => false));
      await shot(p1, '01-viewer-settings');
      await row.click(); await p1.waitForTimeout(3000);
      ok(`${lang}-${scheme} meals count`, await p1.getByLabel(he ? 'ארוחות, 2' : 'Meals, 2', { exact: true }).isVisible().catch(() => false));
      ok(`${lang}-${scheme} runner played twice`, await p1.getByLabel(he ? /פעמיים/ : /Run with Stedio, 2 times/).first().isVisible().catch(() => false));
      ok(`${lang}-${scheme} no conversation text`, !(await p1.getByText('pita for lunch').count()));
      await shot(p1, '02-app-use-7');
      await p1.mouse.move(195, 600); await p1.mouse.wheel(0, 2000); await p1.waitForTimeout(800);
      await shot(p1, '03-app-use-7-games');
      await p1.getByText(he ? '30 ימים' : '30 days', { exact: true }).first().click(); await p1.waitForTimeout(2000);
      ok(`${lang}-${scheme} 30 days`, await p1.getByLabel(he ? 'ימים עם פעילות, 1 מתוך 30' : 'Days with activity, 1 of 30', { exact: true }).isVisible().catch(() => false));
      if (lang === 'en' && scheme === 'light') await shot(p1, '04-app-use-30');
      await c1.close();

      if (lang === 'en' && scheme === 'light') {
        const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US' });
        const p2 = await c2.newPage(); p2.setDefaultTimeout(6000);
        await signIn(p2, auntMail, false);
        await viewNoamSettings(p2, false);
        ok('other follower sees no row', !(await p2.getByText("Noam's app use", { exact: true }).count()));
        await c2.close();
      }
    }
  } catch (e) {
    results.push(`FAIL crashed — ${e.message}`);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
  process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
});
