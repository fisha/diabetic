// Data age on every glucose value and the "connection lost" banner (DAP-14, Guy, 16 Nov 2026), end-to-end against the
// test server (services/api: uvicorn tests.e2e_server:app).
// Usage: node tools/e2e/data-age.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up a@example.com. The lost CareLink link is written straight into the test
// database (E2E_PSQL, a psql connection string), since signing in to CareLink is not possible here.
const http = require('http'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const PSQL = process.env.E2E_PSQL || 'postgresql://steady:steady@localhost:5432/steady_e2e';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const sql = (q) => execFileSync('psql', [PSQL, '-tAc', q]).toString().trim();
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '80-140' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'a@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'a@example.com', password: 'correct horse battery' } })).json.access_token;
    await api('/profile', { method: 'PUT', token: tk, body: { locale: 'en', answers: ANSWERS } });
    // A reading 25 minutes old (a run takes a minute or two, so up to 27): past the 15 minutes after which a value is not current.
    const at = new Date(Date.now() - 25 * 60_000).toISOString();
    const g = await api('/glucose', { method: 'POST', token: tk, body: { idempotency_key: 'age-e2e-1', measured_at: at, entered_at: at, source: 'manual', method: 'sensor', value: 132, unit: 'mg/dL' } });
    ok('reading saved', g.status === 200 || g.status === 201, String(g.status));
    // A CareLink link whose last fetch that worked was two hours ago.
    const uid = sql("select id from users where email = 'a@example.com'");
    sql(`insert into device_links (id, user_id, kind, region, sealed, status, last_sync_at, created_at) values (gen_random_uuid(), '${uid}', 'carelink', 'eu', 'x', 'failed', now() - interval '2 hours', now() - interval '3 days')`);
    const conns = (await api('/devices/connections', { token: tk })).json;
    ok('connections: CareLink is lost', Array.isArray(conns) && conns.length === 1 && conns[0].lost === true, JSON.stringify(conns));

    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']])) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const T = he
        ? { lost: 'החיבור ל-⁦CareLink⁩ נותק', age: /לפני 2[5-7] דק׳/, stale: 'לא עדכני', check: 'לבדיקת החיבור', overview: 'סקירה' }
        : { lost: 'Connection to ⁦CareLink⁩ lost', age: /2[5-7] min ago/, stale: 'Not current', check: 'Check connection', overview: 'Overview' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('a@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      await shot('01-main');
      const body = await page.locator('body').innerText();
      ok(`${lang} ${scheme}: main screen banner names CareLink`, body.includes(T.lost.replace(/[⁦⁩]/g, '')) || body.includes(T.lost), body.slice(0, 200).replace(/\n/g, ' | '));
      ok(`${lang} ${scheme}: main screen reading shows its age`, T.age.test(body));
      ok(`${lang} ${scheme}: main screen reading is marked not current`, body.includes(T.stale));
      await page.getByRole('tab', { name: T.overview }).first().click().catch(async () => page.getByText(T.overview, { exact: true }).last().click());
      await page.waitForTimeout(4000);
      await shot('02-overview');
      const ov = await page.locator('body').innerText();
      ok(`${lang} ${scheme}: Overview banner`, ov.includes(T.lost.replace(/[⁦⁩]/g, '')) || ov.includes(T.lost));
      ok(`${lang} ${scheme}: Overview reading shows its age`, T.age.test(ov));
      if (lang === 'en') {
        await page.getByText(T.check, { exact: true }).last().click(); await page.waitForTimeout(2500);
        await shot('03-connection-screen');
        ok('banner opens the CareLink screen', (await page.getByText('CareLink').count()) > 0);
      }
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
