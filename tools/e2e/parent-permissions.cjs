// Parental permissions in Kids and Teen mode (PM-386, Guy 21 Nov 2026): the parent's screen has meal photo reading,
// WhatsApp, lab reading, weather, quiet hours' times and an OK for new followers; the teen sees them read-only, the
// closed ways are gone from the app, and a new follower waits for the parent's OK.
// Usage: node tools/e2e/parent-permissions.cjs <web export (EXPO_PUBLIC_API_URL=http://localhost:8000)> <screenshot dir>
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
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '70-180' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };
const PW = 'correct horse battery';
const run = Date.now().toString(36);
const d = new Date(); const birth = { day: String(d.getDate()), month: String(d.getMonth() + 1), year: String(d.getFullYear() - 15) };

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
    const kidMail = `pp-kid-${run}@example.com`; const dadMail = `pp-dad-${run}@example.com`;
    const kid = await signUp(kidMail); const dad = await signUp(dadMail);
    await consent(kid); await consent(dad);
    await api('/auth/birth', { method: 'PUT', token: kid, body: { birth } });
    const inv = (await api('/sharing/invites', { method: 'POST', token: kid, body: { scopes: ['glucose', 'insights'], consent: true, relation: 'dad', guardian: true } })).json;
    await api('/sharing/accept', { method: 'POST', token: dad, body: { code: inv.code, guardian_confirm: true } });
    await api('/profile', { method: 'PUT', token: kid, body: { locale: 'en', answers: { ...ANSWERS, ageGate: 'under18', birth, companion: { ...ANSWERS.companion, callMe: 'Maya' } } } });
    await api('/profile', { method: 'PUT', token: dad, body: { locale: 'en', answers: { ...ANSWERS, companion: { ...ANSWERS.companion, callMe: 'Guy' } } } });

    const signIn = async (page, email, he) => {
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click().catch(() => null); await page.waitForTimeout(800); }
      await page.getByText(he ? 'כבר יש לי חשבון' : 'I already have an account', { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(he ? 'אימייל' : 'Email', { exact: true }).fill(email);
      await page.getByLabel(he ? 'סיסמה' : 'Password', { exact: true }).fill(PW);
      await page.getByText(he ? 'כניסה' : 'Sign in', { exact: true }).last().click(); await page.waitForTimeout(4500);
    };
    const settingsTab = async (page, he) => {
      const s = he ? 'הגדרות' : 'Settings';
      await page.getByRole('tab', { name: s }).first().click({ timeout: 3000 }).catch(() => page.getByText(s, { exact: true }).last().click());
      await page.waitForTimeout(2500);
    };

    for (const [lang, scheme] of [['en', 'light'], ['he', 'dark']]) {
      const he = lang === 'he';
      for (const tk of [kid, dad]) {
        const prof = (await api('/profile', { token: tk })).json;
        await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: prof.answers } });
      }
      const share = (await api('/sharing', { token: dad })).json.viewing[0].id;
      await api(`/sharing/${share}/young`, { method: 'PUT', token: dad, body: { meal_photo: true, whatsapp: true, labs: true, weather: true, approve_followers: false } });
      const shot = (page, name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`), fullPage: true });

      // The parent: switch to Maya, open Teen mode controls.
      const c1 = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: he ? 'he-IL' : 'en-US', deviceScaleFactor: 1 });
      const p1 = await c1.newPage(); p1.on('pageerror', (e) => errors.push(e.message)); p1.setDefaultTimeout(6000);
      await signIn(p1, dadMail, he);
      await p1.getByText(he ? 'החלפה' : 'Switch', { exact: true }).first().click(); await p1.waitForTimeout(1000);
      await p1.getByText('Maya', { exact: true }).last().click(); await p1.waitForTimeout(3500);
      await settingsTab(p1, he);
      await p1.getByText(he ? /מצב ילדים ונוער/ : /Kids and Teen mode for Maya/).first().click(); await p1.waitForTimeout(2500);
      await shot(p1, '01-parent-controls');
      ok(`${lang} ${scheme}: parent sees the permissions`, (await p1.getByText(he ? 'קריאת בדיקות מעבדה מתמונה' : 'Reading lab reports', { exact: true }).count()) > 0);
      // Turn lab reading off and ask for an OK on new followers.
      await p1.getByRole('switch', { name: he ? 'קריאת בדיקות מעבדה מתמונה' : 'Reading lab reports' }).first().click(); await p1.waitForTimeout(1200);
      await p1.getByRole('switch', { name: he ? 'אישור שלי לעוקבים חדשים' : 'My OK for new followers' }).first().click(); await p1.waitForTimeout(1500);
      const c = (await api(`/sharing/${share}/young`, { token: dad })).json.controls;
      ok(`${lang} ${scheme}: switches saved`, c.labs === false && c.approve_followers === true, JSON.stringify({ labs: c.labs, approve: c.approve_followers }));
      // A friend accepts Maya's invite and waits.
      const friendMail = `pp-friend-${lang}-${run}@example.com`; const friend = await signUp(friendMail); await consent(friend);
      const code = (await api('/sharing/invites', { method: 'POST', token: kid, body: { scopes: ['glucose'], consent: true, relation: 'friend' } })).json.code;
      const acc = (await api('/sharing/accept', { method: 'POST', token: friend, body: { code } })).json;
      ok(`${lang} ${scheme}: friend waits for the parent`, acc.waiting_parent === true);
      await p1.reload(); await p1.waitForTimeout(3500);
      await shot(p1, '02-parent-pending');
      await p1.getByText(he ? 'לאשר' : 'Approve', { exact: true }).last().click(); await p1.waitForTimeout(2000);
      const opened = (await api('/sharing', { token: friend })).json.viewing[0];
      ok(`${lang} ${scheme}: approved opens the share`, opened && opened.waiting_parent === false);
      await c1.close();

      // The teen: "Set by your parent" shows the switches, and lab reading is gone.
      const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: he ? 'he-IL' : 'en-US', deviceScaleFactor: 1 });
      const p2 = await c2.newPage(); p2.on('pageerror', (e) => errors.push(e.message)); p2.setDefaultTimeout(6000);
      await signIn(p2, kidMail, he);
      await settingsTab(p2, he);
      await p2.getByText(he ? 'נקבע על ידי ההורה' : 'Set by your parent', { exact: true }).first().click(); await p2.waitForTimeout(2500);
      await shot(p2, '03-teen-set-by-parent');
      ok(`${lang} ${scheme}: teen sees lab reading turned off`, (await p2.getByText(he ? 'קריאת בדיקות מעבדה מתמונה' : 'Reading lab reports', { exact: true }).count()) > 0);
      await p2.goto(`${base}/labs`); await p2.waitForTimeout(8000);
      await shot(p2, '04-teen-labs');
      ok(`${lang} ${scheme}: lab photo buttons gone`, (await p2.getByText(he ? 'כבוי על ידי ההורה' : 'Turned off by your parent').count()) > 0);
      // Meal photos off: the quick log's meal card has no camera, and a link to the camera opens Log a meal.
      await api(`/sharing/${share}/young`, { method: 'PUT', token: dad, body: { meal_photo: false } });
      await p2.goto(`${base}/log`); await p2.waitForTimeout(6000);
      await shot(p2, '05-teen-quick-log-no-photo');
      const photoLabel = he ? 'צילום ארוחה' : 'Meal photo';
      ok(`${lang} ${scheme}: quick log has no meal photo`, (await p2.getByRole('button', { name: photoLabel, exact: true }).count()) === 0 && (await p2.getByText(photoLabel, { exact: true }).count()) === 0);
      await p2.goto(`${base}/meal/camera`); await p2.waitForTimeout(5000);
      ok(`${lang} ${scheme}: camera link opens Log a meal`, !p2.url().includes('/camera'), p2.url());
      await api(`/sharing/${share}/young`, { method: 'PUT', token: dad, body: { meal_photo: true } });
      await c2.close();
    }
  } catch (e) { results.push(`FAIL crashed — ${e.message}`); }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
  process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
});
