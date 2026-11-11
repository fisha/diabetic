// Stage 3 end-to-end check against a running API (localhost:8000, CORS for localhost:8090) and PostgreSQL.
// Usage: node tools/e2e/stage3.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up a@example.com and b@example.com.
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
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  const newPage = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage(); global.lastPage = page; // for the failure screenshot
    page.on('pageerror', (e) => errors.push(e.message));
    return page;
  };
  const shot = (page, n) => page.screenshot({ path: path.join(out, `${n}.png`) });
  const signIn = async (page, email, pw) => {
    await page.goto(`${base}/sign-in`); await page.waitForTimeout(1500);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(pw);
    await page.getByText('Sign in', { exact: true }).last().click();
    await page.waitForTimeout(2000);
  };
  // On the web the session lives in memory, so navigate inside the app (tab bar, Companion chips), never reload.
  const tab = async (page, name) => { await page.getByRole('tab', { name, exact: true }).click(); await page.waitForTimeout(2000); };
  const logGlucose = async (page, v) => {
    await tab(page, 'Companion');
    await page.getByText('Glucose', { exact: true }).first().click(); await page.waitForTimeout(1500);

    await page.getByLabel('Reading, mg/dL', { exact: true }).fill(v);
    await page.getByText('Save reading', { exact: true }).last().click();
    await page.waitForTimeout(1500);
  };
  try {
    // 1. Sign-up through the screens lands on the first setup step.
    let page = await newPage();
    await page.goto(`${base}/welcome`); await page.waitForTimeout(1500);
    await page.getByText('Get started', { exact: true }).click(); await page.waitForTimeout(800);
    await page.getByLabel('Email', { exact: true }).fill('a@example.com');
    await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
    await page.getByText('Create account', { exact: true }).last().click(); await page.waitForTimeout(2500);
    ok('sign-up opens setup', page.url().endsWith('/onboarding/consent'), page.url());
    await shot(page, '01-after-sign-up');
    // The same email again is refused with the G-22 message.
    const p2 = await newPage();
    await p2.goto(`${base}/sign-up`); await p2.waitForTimeout(1500);
    await p2.getByLabel('Email', { exact: true }).fill('a@example.com');
    await p2.getByLabel('Password', { exact: true }).fill('another password');
    await p2.getByText('Create account', { exact: true }).last().click(); await p2.waitForTimeout(1500);
    ok('duplicate email message', await p2.getByText('There’s already an account with this email. Sign in instead.').isVisible());
    await shot(p2, '02-email-taken');

    // Profile for A (onboarding answers) through the API, then sign in through the screens.
    const ta = (await api('/auth/sign-in', { method: 'POST', body: { email: 'a@example.com', password: 'correct horse battery' } })).json;
    ok('profile saved', (await api('/profile', { method: 'PUT', token: ta.access_token, body: { locale: 'en', answers: ANSWERS } })).status === 200);

    page = await newPage();
    await signIn(page, 'a@example.com', 'wrong password!!');
    ok('wrong password message', await page.getByText('That email and password don’t match an account.').isVisible());
    await shot(page, '03-wrong-password');
    await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
    await page.getByText('Sign in', { exact: true }).last().click(); await page.waitForTimeout(2000);
    ok('sign-in opens Companion', page.url().endsWith('/companion'), page.url());

    // 2. A reading is saved, then shown in the journal and the overview.
    await logGlucose(page, '124');
    ok('saved toast', await page.getByText('Saved to your journal').first().isVisible());
    await shot(page, '04-saved');
    await tab(page, 'Journal');
    ok('journal shows the reading', await page.getByText('124 mg/dL').first().isVisible());
    await shot(page, '05-journal');
    await tab(page, 'Overview');
    await shot(page, '06-overview');
    ok('overview latest reading', await page.getByText('Latest reading').first().isVisible() && (await page.getByText('124').count()) > 0);

    // 3. Correction: a new revision, with the original kept.
    await tab(page, 'Journal');
    await page.getByText('124 mg/dL').last().click(); await page.waitForTimeout(800);
    await page.getByText('Edit', { exact: true }).first().click(); await page.waitForTimeout(800);
    await page.getByLabel('Reading, mg/dL', { exact: true }).fill('130');
    await page.getByText('Save correction', { exact: true }).click(); await page.waitForTimeout(2000);
    ok('journal shows the correction', await page.getByText('130 mg/dL').first().isVisible());
    await page.getByText('130 mg/dL').last().click(); await page.waitForTimeout(1500);
    ok('correction history', await page.getByText('Correction history').isVisible() && await page.getByText('124 mg/dL').first().isVisible());
    await shot(page, '07-detail-history');
    await page.getByLabel('Back to journal').first().click(); await page.waitForTimeout(500);

    // 4. Offline: the reading waits on the phone, then syncs once.
    await page.route('http://localhost:8000/**', (r) => r.abort());
    await logGlucose(page, '99');
    ok('pending toast', await page.getByText('Waiting to sync').first().isVisible());
    await tab(page, 'Journal');
    await shot(page, '08-journal-pending');
    ok('journal pending badge', await page.getByText('Pending sync').first().isVisible().catch(() => false));
    await page.unroute('http://localhost:8000/**');
    await page.waitForTimeout(33000); // the queue retries every 30 s
    await tab(page, 'Overview'); await tab(page, 'Journal');
    await shot(page, '09-journal-synced');
    const listA = await api(`/glucose?since=${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}&until=${encodeURIComponent(new Date(Date.now() + 3600000).toISOString())}`, { token: ta.access_token });
    ok('server has exactly two readings for A', listA.json.length === 2, JSON.stringify(listA.json.map((r) => [r.value, r.revision])));
    ok('no pending badge after sync', !(await page.getByText('Pending sync').first().isVisible().catch(() => false)));

    // 5. Another account sees none of it.
    await api('/auth/sign-up', { method: 'POST', body: { email: 'b@example.com', password: 'another long password' } });
    const tb = (await api('/auth/sign-in', { method: 'POST', body: { email: 'b@example.com', password: 'another long password' } })).json;
    await api('/profile', { method: 'PUT', token: tb.access_token, body: { locale: 'en', answers: ANSWERS } });
    ok('B gets 404 for A’s record', (await api(`/glucose/${listA.json[0].id}`, { token: tb.access_token })).status === 404);
    const pb = await newPage();
    await signIn(pb, 'b@example.com', 'another long password');
    await tab(pb, 'Journal');
    ok('B’s journal is empty', (await pb.getByText('mg/dL').count()) === 0);
    await shot(pb, '10-journal-b');
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); await global.lastPage.screenshot({ path: path.join(out, 'zz-fail.png') }); console.log('fail url', global.lastPage.url());
  }
  console.log(results.join('\n'));
  console.log(errors.length ? 'page errors:\n' + [...new Set(errors)].join('\n') : 'no page errors');
  await browser.close(); server.close();
});
