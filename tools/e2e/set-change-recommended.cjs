// "Change recommended" on day 4 of the set (PM-437, Guy 23 Nov 2026): a set changed three days ago shows the badge on
// Overview's set row, for the person and for someone viewing their data; a set changed yesterday does not.
// Usage: node tools/e2e/set-change-recommended.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000 and EXPO_PUBLIC_WEBSITE_URL=http://localhost:8090> <screenshot dir>
// Against the test server (services/api: uvicorn tests.e2e_server:app) from an empty database, with
// STEADY_CORS_ORIGINS=["http://localhost:8090"], STEADY_ALLOW_EMAIL_SIGN_UP=true, STEADY_REQUIRE_EMAIL_VERIFICATION=false,
// STEADY_REQUIRE_APPROVAL=false. Signs up kid@example.com and parent@example.com. ONLY=he:light runs one look.
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
const ANSWERS = { version: 1, infusionSet: 'standard', consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '70-180' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };
const PW = 'correct horse battery';
const tab = (page, name) => page.getByRole('tab', { name }).first().click({ timeout: 3000 }).catch(() => page.getByText(name, { exact: true }).last().click());
const meal = (key, name, carbs, minAgo) => ({ idempotency_key: key, kind: 'meal', occurred_at: new Date(Date.now() - minAgo * 60000).toISOString(), entered_at: new Date().toISOString(), source: 'manual', data: { items: [{ name, unit: 'g', qty: 100, carbs_g: carbs, prov: 'wt', weighed: true }], ate: 'all', carbs_total_g: carbs, any_unknown: false } });
let lastPage = null;

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    const accept = async (tk) => {
      const docs = (await api('/consent', { token: tk })).json;
      await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
      await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
    };
    const account = async (email, name) => {
      await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
      const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
      await api('/profile', { method: 'PUT', token: tk, body: { locale: 'en', answers: { ...ANSWERS, companion: { ...ANSWERS.companion, callMe: name } } } });
      await accept(tk);
      return tk;
    };
    const kid = await account('kid@example.com', 'Yonatan');
    const parent = await account('parent@example.com', 'Guy');
    const cl = await api('/devices/carelink', { method: 'PUT', token: kid, body: { username: 'kid_cl', password: 'pump-pass' } });
    ok('kid connects CareLink', cl.status === 200, String(cl.status));
    await api('/settings', { method: 'PATCH', token: kid, body: { timezone: 'UTC' } });
    const d = new Date(); const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    // A set changed three days ago (as far back as "I changed my set" goes): today is day 4.
    const sc = await api('/devices/set-change', { method: 'POST', token: kid, body: { at: new Date(Date.now() - 3 * 86400000 + 300000).toISOString() } });
    ok('kid marks a set change three days ago', sc.status === 200, String(sc.status));
    const own = (await api('/devices/equipment', { token: kid })).json;
    ok('day 4: change recommended', own.set_change_recommended === true, JSON.stringify(own));
    const code = (await api('/sharing/invites', { method: 'POST', token: kid, body: { scopes: ['glucose'], relation: 'family', consent: true } })).json.code;
    const acc = await api('/sharing/accept', { method: 'POST', token: parent, body: { code } });
    ok('parent follows the kid', acc.status === 200, String(acc.status));
    const kidId = acc.json.owner_id;
    const viewed = await fetch(API + '/devices/equipment', { headers: { authorization: `Bearer ${parent}`, 'X-View-As': kidId } });
    ok('follower reads the same', viewed.status === 200 && (await viewed.json()).set_change_recommended === true);
    const looks = [['he', 'light', 'kid'], ['he', 'light', 'parent'], ['en', 'light', 'kid'], ['en', 'light', 'parent'], ['he', 'dark', 'kid'], ['he', 'light', 'kid-day2']];
    for (const [lang, scheme, who0] of looks) {
      const he = lang === 'he'; const who = who0.replace('-day2', '');
      if (who0 === 'kid-day2') {
        await api('/devices/set-change', { method: 'POST', token: kid, body: { at: new Date(midnight - 86400000 + 3600000).toISOString() } });
        const e2 = (await api('/devices/equipment', { token: kid })).json;
        ok('day 2: not recommended', e2.set_change_recommended === false, JSON.stringify(e2));
      }
      for (const tk of [kid, parent]) await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: { ...ANSWERS, companion: { ...ANSWERS.companion, callMe: tk === kid ? 'Yonatan' : 'Guy' } } } });
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const T = he ? { sw: 'החלפה', overview: 'סקירה', set: 'סט עירוי', rec: 'מומלץ להחליף', day4: 'יום 4', day2: 'יום 2' } : { sw: 'Switch', overview: 'Overview', set: 'Infusion set', rec: 'Change recommended', day4: 'Day 4', day2: 'Day 2' };
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: he ? 'he-IL' : 'en-US', deviceScaleFactor: 2, timezoneId: 'UTC' });
      const p = await ctx.newPage(); lastPage = p; p.on('pageerror', (e) => errors.push(e.message)); p.setDefaultTimeout(6000);
      const visible = async (s) => (await p.getByText(s, { exact: true }).count()) > 0;
      await p.goto(base); await p.waitForTimeout(2000);
      if (he) { await p.getByText('עברית', { exact: true }).first().click().catch(() => null); await p.waitForTimeout(800); }
      await p.getByText(L.have, { exact: true }).last().click(); await p.waitForTimeout(1500);
      await p.getByLabel(L.email, { exact: true }).fill(`${who}@example.com`);
      await p.getByLabel(L.pw, { exact: true }).fill(PW);
      await p.getByText(L.go, { exact: true }).last().click(); await p.waitForTimeout(4000);
      if (who === 'parent') {
        await tab(p, T.overview); await p.waitForTimeout(1500);
        await p.getByText(T.sw, { exact: true }).first().click(); await p.waitForTimeout(800);
        await p.getByText('Yonatan', { exact: true }).last().click(); await p.waitForTimeout(2500);
      }
      await tab(p, T.overview); await p.waitForTimeout(3000);
      const row = p.getByText(T.set, { exact: true }).last();
      if (await row.count()) await row.scrollIntoViewIfNeeded();
      await p.waitForTimeout(500);
      await p.screenshot({ path: path.join(out, `${lang}-${scheme}-${who0}.png`) });
      if (who0 === 'kid-day2') ok(`${lang} ${scheme} ${who0}: day 2, no badge`, (await visible(T.day2)) && !(await visible(T.rec)));
      else ok(`${lang} ${scheme} ${who0}: day 4 with the badge`, (await visible(T.day4)) && (await visible(T.rec)));
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
    if (lastPage) await lastPage.screenshot({ path: path.join(out, 'zz-failure.png') }).catch(() => null);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
