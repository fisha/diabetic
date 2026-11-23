// Admin area and in-app support (Guy, 23 Nov 2026, PM-445..448), end to end against the test server
// (services/api: uvicorn tests.e2e_server:app; env STEADY_ALLOW_EMAIL_SIGN_UP=true STEADY_REQUIRE_EMAIL_VERIFICATION=false
// STEADY_REQUIRE_APPROVAL=false STEADY_ADMIN_EMAILS=boss@example.com STEADY_CORS_ORIGINS='["http://localhost:8090","http://localhost:3000"]'
// STEADY_JIRA_BASE_URL=http://localhost:8099 STEADY_JIRA_EMAIL=e2e@example.com STEADY_JIRA_API_TOKEN=e2e), a Jira stand-in
// on :8099 that answers 201 {"key": "SUP-n"} and records each call, and the website on :3000 (`next start`, built with
// NEXT_PUBLIC_STEADY_API_URL=http://localhost:8000, the app's website build in public/app).
// Usage: node tools/e2e/admin-area.cjs <app web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir> [jira-calls.jsonl]
// Start from an empty database.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; const jiraLog = process.argv[4]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000'; const WEB = 'http://localhost:3000'; const PW = 'correct horse battery';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '80-140' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Stedio', style: 'warm', classic: true }, checkIns: { frequency: 'moreAtFirst' } };
const account = async (email, locale) => {
  await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
  const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
  const docs = (await api('/consent', { token: tk })).json;
  await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
  await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
  await api('/profile', { method: 'PUT', token: tk, body: { locale, answers: ANSWERS } });
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
  // Google's sign-in script is cut off by the sandbox's network and throws "gis is not defined"; not ours.
  const onErr = (e) => { if (!/gis is not defined/.test(e.message)) errors.push(e.message); };
  try {
    const boss = await account('boss@example.com', 'en');
    const ids = {};
    // 1. The person, on the phone: Help has only "Contact support"; a new request; support answers; the person replies.
    for (const [lang, scheme] of [['en', 'light'], ['he', 'dark']]) {
      const he = lang === 'he'; const email = `${lang}@example.com`;
      await account(email, lang);
      const L = he
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', contact: 'פנייה לתמיכה', report: 'דיווח על בעיה', subject: 'נושא', text: 'הודעה', cat: 'מכשירים וסנכרון', pri: 'גבוה', send: 'שליחה', reply: 'התשובה שלך', sendReply: 'שליחת תשובה', mine: 'הפניות שלך', team: 'התמיכה של Stedio' }
        : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', contact: 'Contact support', report: 'Report a problem', subject: 'Subject', text: 'Message', cat: 'Devices and syncing', pri: 'High', send: 'Send', reply: 'Your reply', sendReply: 'Send reply', mine: 'Your requests', team: 'Stedio support' };
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: he ? 'he-IL' : 'en-US', timezoneId: 'Asia/Jerusalem', deviceScaleFactor: 2 });
      const page = await ctx.newPage(); page.on('pageerror', onErr); page.setDefaultTimeout(8000);
      const shot = (name) => page.screenshot({ path: path.join(out, `app-${lang}-${scheme}-${name}.png`) });
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click().catch(() => null); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill(email);
      await page.getByLabel(L.pw, { exact: true }).fill(PW);
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await page.goto(`${base}/settings/help`); await page.waitForTimeout(3000);
      ok(`${lang}: Help has Contact support`, (await page.getByText(L.contact, { exact: true }).count()) > 0);
      ok(`${lang}: Help has no Report a problem`, (await page.getByText(L.report).count()) === 0);
      await shot('01-help');
      await page.getByText(L.contact, { exact: true }).last().click(); await page.waitForTimeout(2000);
      await page.getByLabel(L.subject, { exact: true }).fill(he ? 'הסנכרון נעצר' : 'Sync stopped');
      await page.getByText(L.cat, { exact: true }).last().click();
      await page.getByText(L.pri, { exact: true }).last().click();
      await page.getByLabel(L.text, { exact: true }).fill(he ? 'מאתמול בערב לא מגיעות מדידות מהחיישן.' : 'No sensor readings since last night.');
      await shot('02-new');
      await page.getByText(L.send, { exact: true }).last().click(); await page.waitForTimeout(3000);
      ok(`${lang}: request screen after send`, /\/settings\/support\/[0-9a-f-]{36}/.test(page.url()), page.url());
      ids[lang] = page.url().split('/').pop();
      await shot('03-sent');
      // Support answers from the admin pages' API; the person opens the request again.
      const a = await api(`/admin/support/${ids[lang]}/messages`, { method: 'POST', token: boss, body: { text: he ? 'בדקנו, נסו להתחבר מחדש ב-CareLink.' : 'We checked. Please sign in to CareLink again.' } });
      ok(`${lang}: admin answer saved`, a.status === 200 || a.status === 201, String(a.status));
      await page.goto(`${base}/settings/help`); await page.waitForTimeout(3000);
      ok(`${lang}: Help lists the request`, (await page.getByText(L.mine, { exact: true }).count()) > 0);
      await shot('04-help-list');
      await page.getByText(he ? 'הסנכרון נעצר' : 'Sync stopped', { exact: true }).first().click(); await page.waitForTimeout(3000);
      ok(`${lang}: support's answer shown`, (await page.getByText(he ? 'בדקנו' : 'We checked', { exact: false }).count()) > 0);
      await page.getByLabel(L.reply, { exact: true }).fill(he ? 'עבד, תודה!' : 'That worked, thanks!');
      await page.getByText(L.sendReply, { exact: true }).last().click(); await page.waitForTimeout(2500);
      ok(`${lang}: reply shown`, (await page.getByText(he ? 'עבד, תודה!' : 'That worked, thanks!').count()) > 0);
      await shot('05-conversation');
      await ctx.close();
    }
    const detail = (await api(`/admin/support/${ids.en}`, { token: boss })).json;
    ok('admin sees the request with the app it came from', detail && detail.category === 'devices' && detail.priority === 'high' && detail.messages.length === 3 && !!detail.platform, JSON.stringify(detail && [detail.category, detail.priority, detail.messages.length, detail.platform]));
    ok('the person read support\'s answer (read receipt)', detail && detail.messages.some((m) => m.sender === 'admin' && m.read_by_user_at));

    // 2. The admin on the website. Repro of the bug: "In the app" on a user leaves a viewed account behind; signing in
    // to the app again must still land on the admin pages.
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, deviceScaleFactor: 2 });
      const page = await ctx.newPage(); page.on('pageerror', onErr); page.setDefaultTimeout(8000);
      const shot = (name, full = true) => page.screenshot({ path: path.join(out, `web-${scheme}-${name}.png`), fullPage: full });
      await page.goto(`${WEB}/app`); await page.waitForTimeout(3000);
      await page.getByText('I already have an account', { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel('Email', { exact: true }).fill('boss@example.com');
      await page.getByLabel('Password', { exact: true }).fill(PW);
      await page.getByText('Sign in', { exact: true }).last().click(); await page.waitForTimeout(6000);
      ok(`${scheme}: admin signing in to the app lands on the admin hub`, /\/dashboard\/admin\/?$/.test(page.url()), page.url());
      await shot('01-hub');
      await page.getByRole('link', { name: 'Users', exact: true }).first().click(); await page.waitForTimeout(2500);
      await shot('02-users');
      // "In the app" for en@example.com opens a view-as tab; close it.
      const row = page.locator('tr', { hasText: 'en@example.com' });
      const [pop] = await Promise.all([ctx.waitForEvent('page'), row.getByRole('button', { name: 'In the app' }).click()]);
      await pop.waitForTimeout(5000); await pop.close();
      // The email opens the profile.
      await row.getByRole('link', { name: 'en@example.com' }).click(); await page.waitForTimeout(2500);
      ok(`${scheme}: profile shows the install`, (await page.getByText(/Chrome|web/i).count()) > 0);
      ok(`${scheme}: profile shows last sign-in`, (await page.getByText('Last sign-in', { exact: true }).count()) > 0 && (await page.getByText('Not recorded yet').count()) === 0);
      await shot('03-profile');
      await page.getByRole('button', { name: 'Reset password' }).click(); await page.waitForTimeout(1500);
      ok(`${scheme}: reset answers (no mail sender in the test server)`, (await page.getByText(/Email is not set up|reset code was emailed|moment ago/).count()) > 0);
      // Support.
      await page.getByRole('link', { name: 'Support', exact: true }).first().click(); await page.waitForTimeout(2500);
      ok(`${scheme}: support lists both requests`, (await page.getByText('Sync stopped').count()) > 0 && (await page.getByText('הסנכרון נעצר').count()) > 0);
      await shot('04-support');
      await page.getByText('Sync stopped', { exact: true }).first().click(); await page.waitForTimeout(2500);
      ok(`${scheme}: conversation in the admin pages`, (await page.getByText('That worked, thanks!').count()) > 0);
      await shot('05-ticket');
      if (scheme === 'light') {
        await page.getByRole('button', { name: 'Create Jira issue' }).click(); await page.waitForTimeout(800);
        await page.getByLabel('Description').fill('CareLink sync stopped overnight; reconnecting fixed it. Check token renewal.');
        await shot('06-jira', false);
        await page.getByRole('button', { name: 'Create issue', exact: true }).click(); await page.waitForTimeout(2000);
        ok('Jira issue made', (await page.getByText(/SUP-1/).count()) > 0);
        await shot('07-jira-made');
      }
      // Analytics.
      await page.getByRole('link', { name: 'Analytics', exact: true }).first().click(); await page.waitForTimeout(3000);
      ok(`${scheme}: analytics shows people and agents`, (await page.getByText('Accounts', { exact: true }).count()) > 0 && (await page.getByText('Agents', { exact: true }).count()) > 0);
      await shot('08-analytics');
      // Back in the app in a new tab: the admin pages again, not the account viewed before.
      const again = await ctx.newPage(); again.on('pageerror', onErr);
      await again.goto(`${WEB}/app/companion`); await again.waitForTimeout(6000);
      ok(`${scheme}: app again after "In the app" lands on the admin hub`, /\/dashboard\/admin\/?$/.test(again.url()), again.url());
      // "My app" opens the admin's own app and stays there.
      await again.goto(`${WEB}/app/companion?own=1`); await again.waitForTimeout(6000);
      ok(`${scheme}: My app stays in the app`, /\/app\//.test(again.url()), again.url());
      await again.screenshot({ path: path.join(out, `web-${scheme}-09-my-app.png`) });
      await ctx.close();
    }
    if (jiraLog) {
      const calls = fs.readFileSync(jiraLog, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      const body = JSON.stringify(calls[0]?.body ?? {});
      ok('one Jira call, to the Support project, with auth', calls.length === 1 && calls[0].auth && calls[0].body.fields.project.key === 'SUP');
      ok('Jira gets no message text or email', !/No sensor readings|That worked|en@example\.com/.test(body));
    }
  } catch (e) { ok('no exception', false, e.stack); }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n')); await browser.close(); server.close();
});
