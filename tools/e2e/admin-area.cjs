// Admin area and in-app support (Guy, 23 Nov 2026, PM-445..448; Jira Service Management PM-466), end to end against the test server
// (services/api: uvicorn tests.e2e_server:app; env STEADY_ALLOW_EMAIL_SIGN_UP=true STEADY_REQUIRE_EMAIL_VERIFICATION=false
// STEADY_REQUIRE_APPROVAL=false STEADY_ADMIN_EMAILS=boss@example.com STEADY_CORS_ORIGINS='["http://localhost:8090","http://localhost:3000"]'
// STEADY_JIRA_BASE_URL=http://localhost:8099 STEADY_JIRA_EMAIL=e2e@example.com STEADY_JIRA_API_TOKEN=e2e) and the website
// on :3000 (`next start`, built with NEXT_PUBLIC_STEADY_API_URL=http://localhost:8000, the app's website build in
// public/app). This script runs a Jira Service Management stand-in on :8099 itself (customers, requests, comments,
// status), so nothing reaches Atlassian; support's answers are written there and the API's sync is run through
// /e2e/support/sync.
// Usage: node tools/e2e/admin-area.cjs <app web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
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

// The Jira Service Management stand-in (PM-466): what the API sends, and support's side of the conversation.
const jsm = { customers: {}, desk: new Set(), requests: {}, calls: [] };
const jira = http.createServer((req, res) => {
  let raw = ''; req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : null; const u = new URL(req.url, 'http://x'); const p = u.pathname;
    jsm.calls.push({ method: req.method, path: p, body, auth: !!req.headers.authorization });
    const send = (code, j) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(j === undefined ? '' : JSON.stringify(j)); };
    if (p === '/rest/api/3/myself') return send(200, { accountId: 'api-bot' });
    if (p === '/rest/servicedeskapi/customer') { const id = `cust-${Object.keys(jsm.customers).length + 1}`; jsm.customers[body.email] = id; return send(201, { accountId: id }); }
    if (p === '/rest/servicedeskapi/servicedesk/1/customer') { body.accountIds.forEach((a) => jsm.desk.add(a)); return send(204); }
    if (p === '/rest/servicedeskapi/request' && req.method === 'POST') {
      const key = `SUP-${Object.keys(jsm.requests).length + 1}`; jsm.requests[key] = { body, status: ['Waiting for support', 'NEW'], comments: [], labels: [] }; return send(201, { issueKey: key });
    }
    const key = (p.match(/SUP-\d+/) || [])[0]; const r = jsm.requests[key];
    if (!r) return send(404, {});
    if (p.startsWith('/rest/api/3/issue/') && req.method === 'PUT') { r.labels.push(...body.update.labels.map((x) => x.add)); return send(204); }
    if (p.endsWith('/transitions') && req.method === 'GET') return send(200, { transitions: [{ id: '11', to: { name: 'Waiting for support', statusCategory: { key: 'new' } } }] });
    if (p.endsWith('/transitions')) { r.status = ['Waiting for support', 'NEW']; return send(204); }
    if (p.endsWith('/comment') && req.method === 'POST') { const id = String(1000 + r.comments.length); r.comments.push({ id, author: 'api-bot', text: body.body, public: body.public, at: new Date().toISOString() }); return send(201, { id }); }
    if (p.endsWith('/comment')) return send(200, { isLastPage: true, values: r.comments.filter((c) => c.public).map((c) => ({ id: c.id, body: c.text, author: { accountId: c.author }, created: { iso8601: c.at } })) });
    if (req.method === 'GET') return send(200, { issueKey: key, currentStatus: { status: r.status[0], statusCategory: r.status[1] } });
    return send(400, {});
  });
}).listen(8099);
const agentSays = (key, text) => { const r = jsm.requests[key]; r.comments.push({ id: String(2000 + r.comments.length), author: 'agent-1', text, public: true, at: new Date().toISOString() }); r.status = ['Waiting for customer', 'INDETERMINATE']; };

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
      // The request is a customer request in Jira, raised for the person; support answers there; the API's sync brings it back.
      const key = Object.keys(jsm.requests).find((k) => jsm.requests[k].body.raiseOnBehalfOf === jsm.customers[email]);
      ok(`${lang}: customer request in Jira raised for the person`, !!key && jsm.desk.has(jsm.customers[email]), JSON.stringify(Object.keys(jsm.customers)));
      ok(`${lang}: Jira gets the subject and the words, not health data beyond them`, !!key && jsm.requests[key].body.requestFieldValues.summary === (he ? 'הסנכרון נעצר' : 'Sync stopped'));
      agentSays(key, he ? 'בדקנו, נסו להתחבר מחדש ב-CareLink.' : 'We checked. Please sign in to CareLink again.');
      const sy = await api('/e2e/support/sync', { method: 'POST' });
      ok(`${lang}: sync brings support's answer`, sy.json && sy.json.replies === 1, JSON.stringify(sy.json));
      ids[lang] = { id: ids[lang], key };
      await page.goto(`${base}/settings/help`); await page.waitForTimeout(3000);
      ok(`${lang}: Help lists the request`, (await page.getByText(L.mine, { exact: true }).count()) > 0);
      await shot('04-help-list');
      await page.getByText(he ? 'הסנכרון נעצר' : 'Sync stopped', { exact: true }).first().click(); await page.waitForTimeout(3000);
      ok(`${lang}: support's answer shown`, (await page.getByText(he ? 'בדקנו' : 'We checked', { exact: false }).count()) > 0);
      await page.getByLabel(L.reply, { exact: true }).fill(he ? 'עבד, תודה!' : 'That worked, thanks!');
      await page.getByText(L.sendReply, { exact: true }).last().click(); await page.waitForTimeout(2500);
      ok(`${lang}: reply shown`, (await page.getByText(he ? 'עבד, תודה!' : 'That worked, thanks!').count()) > 0);
      ok(`${lang}: reply reached Jira as an internal comment`, jsm.requests[key].comments.some((c) => !c.public && c.text === (he ? 'עבד, תודה!' : 'That worked, thanks!')));
      ok(`${lang}: status from Jira shown`, (await page.getByText(he ? 'בטיפול' : 'In progress').count()) > 0);
      await shot('05-conversation');
      await ctx.close();
    }
    const desc = jsm.requests[ids.en.key].body.requestFieldValues.description;
    ok('Jira request carries the app it came from and no email', /#1/.test(desc) && /web/.test(desc) && !/en@example\.com/.test(desc), desc);
    ok('every Jira call authenticated', jsm.calls.every((c) => c.auth));

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
      // Support (PM-466): titles only, each a link to its request in Jira; no conversation on the website.
      await page.getByRole('link', { name: 'Support', exact: true }).first().click(); await page.waitForTimeout(2500);
      const en = page.getByRole('link', { name: 'Sync stopped', exact: true }); const heLink = page.getByRole('link', { name: 'הסנכרון נעצר', exact: true });
      ok(`${scheme}: support lists both titles as Jira links`, (await en.getAttribute('href')) === `http://localhost:8099/browse/${ids.en.key}` && (await heLink.getAttribute('href')) === `http://localhost:8099/browse/${ids.he.key}`);
      ok(`${scheme}: no words or emails in the list`, (await page.getByText('That worked, thanks!').count()) === 0 && (await page.getByText('en@example.com').count()) === 0);
      ok(`${scheme}: link to the Jira queue`, (await page.getByRole('link', { name: 'Open the support queue in Jira' }).getAttribute('href')) === 'http://localhost:8099/jira/servicedesk/projects/SUP/queues');
      await shot('04-support');
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
  } catch (e) { ok('no exception', false, e.stack); }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n')); await browser.close(); server.close(); jira.close();
});
