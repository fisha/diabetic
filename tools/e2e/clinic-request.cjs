// A clinic's request pops up in the app (PM-428, Guy 23 Nov 2026) end-to-end check against the test server
// (services/api: uvicorn tests.e2e_server:app, with STEADY_ADMIN_EMAILS=admin@example.com and STEADY_CORS_ORIGINS for
// localhost:8091).
// Usage: node tools/e2e/clinic-request.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up p@example.com (the person), admin@example.com and one clinician per clinic.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const PW = 'correct horse battery';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
let adminToken = null;
// Accounts are made with email (STEADY_ALLOW_EMAIL_SIGN_UP=true, STEADY_REQUIRE_EMAIL_VERIFICATION=false) and approved
// by the admin, as off the waiting list.
const account = async (email) => {
  await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
  const token = (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
  if (adminToken) {
    const users = (await api('/admin/users', { token: adminToken })).json;
    const u = (Array.isArray(users) ? users : users.users || []).find((x) => x.email === email);
    if (u) await api(`/admin/users/${u.id || u.user_id}/approve`, { method: 'POST', token: adminToken });
  }
  return token;
};
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Sol', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };

let n = 0;
/** A new clinic with one doctor, who asks to see p@example.com's summary. */
const request = async (admin, name) => {
  n += 1;
  const c = (await api('/admin/clinics', { method: 'POST', token: admin, body: { name, city: 'Haifa' } })).json;
  const email = `doc${n}@example.com`;
  const doc = await account(email);
  const m = await api('/admin/clinic-members', { method: 'PUT', token: admin, body: { email, clinic_id: c.id, role: 'doctor', name: `Dr. Dana Levi ${n}` } });
  const r = await api('/clinic/requests', { method: 'POST', token: doc, body: { email: 'p@example.com' } });
  return { clinic: c, member: m.status, request: r.status };
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
    const admin = await account('admin@example.com');
    adminToken = admin;
    const tk = await account('p@example.com');
    const docs = (await api('/consent', { token: tk })).json;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
    for (const [lang, scheme] of [['en', 'light'], ['he', 'light'], ['he', 'dark']]) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const he = lang === 'he';
      const first = await request(admin, he ? `מרפאת הסוכרת ${scheme}` : 'Carmel Diabetes Clinic');
      ok(`${lang} ${scheme}: clinic request sent`, first.member === 200 && first.request === 202, `member ${first.member} request ${first.request}`);
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      page.setDefaultTimeout(6000);
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const T = he
        ? { share: (c) => `לשתף עם ${c}`, decline: 'לסרב', later: 'לא עכשיו', home: (c) => `${c} מבקשת לראות את הסיכום שלך לפני ביקור`, shared: (c) => `משותף עם ${c}` }
        : { share: (c) => `Share with ${c}`, decline: 'Decline', later: 'Not now', home: (c) => `${c} asks to see your pre-visit summary`, shared: (c) => `Shared with ${c}` };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('p@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill(PW);
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      const c1 = first.clinic.name;
      await shot('01-popped-up');
      ok(`${lang} ${scheme}: the request pops up after sign-in`, (await page.getByText(T.share(c1), { exact: true }).count()) > 0);
      ok(`${lang} ${scheme}: the pop-up has Decline and Not now`, (await page.getByText(T.decline, { exact: true }).count()) > 0 && (await page.getByText(T.later, { exact: true }).count()) > 0);
      await page.getByText(T.later, { exact: true }).last().click(); await page.waitForTimeout(1500);
      ok(`${lang} ${scheme}: Not now closes it`, (await page.getByText(T.share(c1), { exact: true }).count()) === 0);
      ok(`${lang} ${scheme}: the request stays on the main screen`, (await page.getByText(T.home(c1), { exact: true }).count()) > 0);
      await shot('02-not-now-main-screen');
      const still = (await api('/care-team', { token: tk })).json;
      ok(`${lang} ${scheme}: Not now leaves the request open`, still.requests.some((r) => r.id && r.clinic === c1));
      await page.reload(); await page.waitForTimeout(5000);
      ok(`${lang} ${scheme}: it does not pop up again by itself`, (await page.getByText(T.share(c1), { exact: true }).count()) === 0);
      // A second clinic asks: it pops up the next time the app opens.
      const second = await request(admin, he ? `מכבי ${scheme}` : 'Maccabi Haifa');
      const c2 = second.clinic.name;
      await page.reload(); await page.waitForTimeout(5000);
      ok(`${lang} ${scheme}: a new request pops up`, (await page.getByText(T.share(c2), { exact: true }).count()) > 0);
      await shot('03-second-request');
      await page.getByText(T.share(c2), { exact: true }).last().click(); await page.waitForTimeout(2000);
      await shot('04-shared');
      ok(`${lang} ${scheme}: Share closes it with a note`, (await page.getByText(T.share(c2), { exact: true }).count()) === 0 && (await page.getByText(T.shared(c2), { exact: true }).count()) > 0);
      const after = (await api('/care-team', { token: tk })).json;
      const accepted = after.clinics.find((c) => c.clinic === c2);
      ok(`${lang} ${scheme}: shared with the parts shown`, !!accepted && ['sensor', 'insulin', 'lifestyle', 'labs'].every((s) => accepted.scopes.includes(s)) && !accepted.scopes.includes('questions'), JSON.stringify(accepted && accepted.scopes));
      // The first request, from its main-screen row: Decline answers no.
      const firstRow = after.requests.find((r) => r.clinic === c1);
      await page.goto(`${base}/clinic-request?id=${firstRow.id}`); await page.waitForTimeout(4000);
      await page.getByText(T.decline, { exact: true }).last().click(); await page.waitForTimeout(2000);
      const end = (await api('/care-team', { token: tk })).json;
      ok(`${lang} ${scheme}: Decline answers no`, !end.requests.some((r) => r.clinic === c1) && !end.clinics.some((c) => c.clinic === c1));
      // Stop the share so the next run starts clean.
      await api(`/care-team/${accepted.id}`, { method: 'DELETE', token: tk });
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
