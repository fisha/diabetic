// Set and sensor changes for followers (PM-422, Guy 22 Nov 2026): someone viewing another person's data sees the set
// change and the sensor's time left at the bottom of Overview, view only, and can choose set and sensor reminders of
// their own; the person has a set change reminder in Notifications.
// Usage: node tools/e2e/viewer-equipment.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000 and EXPO_PUBLIC_WEBSITE_URL=http://localhost:8090> <screenshot dir>
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
    // The kid's pump: CareLink (the stand-in reports 101 sensor hours left) and a set changed yesterday.
    const cl = await api('/devices/carelink', { method: 'PUT', token: kid, body: { username: 'kid_cl', password: 'pump-pass' } });
    ok('kid connects CareLink', cl.status === 200, String(cl.status));
    const sc = await api('/devices/set-change', { method: 'POST', token: kid, body: { at: new Date(Date.now() - 26 * 3600000).toISOString() } });
    ok('kid marks a set change', sc.status === 200, String(sc.status));
    // Only readings are shared: the set and sensor rows go with them.
    const code = (await api('/sharing/invites', { method: 'POST', token: kid, body: { scopes: ['glucose'], relation: 'family', consent: true } })).json.code;
    const acc = await api('/sharing/accept', { method: 'POST', token: parent, body: { code } });
    ok('parent follows the kid', acc.status === 200, String(acc.status));
    const shareId = acc.json.id; const kidId = acc.json.owner_id;
    const own = (await api('/devices/equipment', { token: kid })).json;
    ok('owner equipment has the set and the sensor', own.set_changed_at && own.sensor_hours_left === 101, JSON.stringify(own));
    const viewed = await fetch(API + '/devices/equipment', { headers: { authorization: `Bearer ${parent}`, 'X-View-As': kidId } });
    ok('follower reads the same equipment', viewed.status === 200 && JSON.stringify(await viewed.json()) === JSON.stringify(own));
    const priv = await fetch(API + '/devices/carelink', { headers: { authorization: `Bearer ${parent}`, 'X-View-As': kidId } });
    ok('the device connection stays private', priv.status === 403, String(priv.status));

    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['he', 'light'], ['en', 'light'], ['he', 'dark']])) {
      const he = lang === 'he';
      for (const tk of [kid, parent]) await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: { ...ANSWERS, companion: { ...ANSWERS.companion, callMe: tk === kid ? 'Yonatan' : 'Guy' } } } });
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const T = he
        ? { sw: 'החלפה', me: 'הנתונים שלי', overview: 'סקירה', set: 'סט עירוי', setSub: 'הוחלף אתמול', sensor: 'חיישן', sensorSub: 'מסתיים בעוד 4 ימים', rem: 'תזכורות בשבילך על Yonatan', setHead: 'החלפת סט', h24: '24 שעות', notif: 'התראות' }
        : { sw: 'Switch', me: 'My data', overview: 'Overview', set: 'Infusion set', setSub: 'Changed yesterday', sensor: 'Sensor', sensorSub: 'Ends in 4 days', rem: 'Reminders for you about Yonatan', setHead: 'Infusion set change', h24: '24 hours', notif: 'Notifications' };
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: he ? 'he-IL' : 'en-US', deviceScaleFactor: 2 });
      const p = await ctx.newPage(); lastPage = p; p.on('pageerror', (e) => errors.push(e.message)); p.setDefaultTimeout(6000);
      const shot = (name) => p.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      const visible = async (s) => (await p.getByText(s, { exact: true }).count()) > 0;
      await p.goto(base); await p.waitForTimeout(2000);
      if (he) { await p.getByText('עברית', { exact: true }).first().click().catch(() => null); await p.waitForTimeout(800); }
      await p.getByText(L.have, { exact: true }).last().click(); await p.waitForTimeout(1500);
      await p.getByLabel(L.email, { exact: true }).fill('parent@example.com');
      await p.getByLabel(L.pw, { exact: true }).fill(PW);
      await p.getByText(L.go, { exact: true }).last().click(); await p.waitForTimeout(4000);
      // Own Overview: the parent has no pump, so no rows.
      await tab(p, T.overview); await p.waitForTimeout(2500);
      ok(`${lang} ${scheme}: no rows on my own Overview`, !(await visible(T.set)));
      await p.getByText(T.sw, { exact: true }).first().click(); await p.waitForTimeout(800);
      await p.getByText('Yonatan', { exact: true }).last().click(); await p.waitForTimeout(2500);
      await tab(p, T.overview); await p.waitForTimeout(3000);
      const setRow = p.getByText(T.set, { exact: true }).last();
      ok(`${lang} ${scheme}: the kid's set row on Overview`, (await setRow.count()) > 0);
      if (await setRow.count()) await setRow.scrollIntoViewIfNeeded();
      await p.waitForTimeout(500);
      await shot('01-viewer-overview-rows');
      ok(`${lang} ${scheme}: set changed yesterday`, await visible(T.setSub));
      ok(`${lang} ${scheme}: sensor time left`, await visible(T.sensor) && await visible(T.sensorSub));
      // The viewer's settings tab: reminders of their own.
      await tab(p, he ? 'הגדרות' : 'Settings'); await p.waitForTimeout(2500);
      const head = p.getByText(T.rem, { exact: true }).last();
      ok(`${lang} ${scheme}: viewer reminders section`, (await head.count()) > 0);
      if (await head.count()) await head.scrollIntoViewIfNeeded();
      await shot('02-viewer-reminders');
      const box = p.getByTestId('vrem-set-24');
      if (await box.count()) {
        await box.click(); await p.waitForTimeout(1500);
        const saved = (await api(`/sharing/${shareId}/reminders`, { token: parent })).json;
        ok(`${lang} ${scheme}: set reminder saved for the viewer`, JSON.stringify(saved.set) === JSON.stringify([24]), JSON.stringify(saved.set));
        await box.click(); await p.waitForTimeout(1500);
        await shot('03-viewer-reminders-after');
      } else ok(`${lang} ${scheme}: set reminder checkbox`, false);
      // Back to own data: the owner's set reminder card in Notifications.
      await p.getByText(T.sw, { exact: true }).first().click(); await p.waitForTimeout(800);
      await p.getByText(T.me, { exact: true }).last().click(); await p.waitForTimeout(2500);
      await ctx.close();
    }
    // The kid's own Notifications: the set reminder card.
    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['he', 'light'], ['en', 'light']])) {
      const he = lang === 'he';
      await api('/profile', { method: 'PUT', token: kid, body: { locale: lang, answers: { ...ANSWERS, companion: { ...ANSWERS.companion, callMe: 'Yonatan' } } } });
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: he ? 'he-IL' : 'en-US', deviceScaleFactor: 2 });
      const p = await ctx.newPage(); lastPage = p; p.on('pageerror', (e) => errors.push(e.message)); p.setDefaultTimeout(6000);
      await p.goto(base); await p.waitForTimeout(2000);
      if (he) { await p.getByText('עברית', { exact: true }).first().click().catch(() => null); await p.waitForTimeout(800); }
      await p.getByText(L.have, { exact: true }).last().click(); await p.waitForTimeout(1500);
      await p.getByLabel(L.email, { exact: true }).fill('kid@example.com');
      await p.getByLabel(L.pw, { exact: true }).fill(PW);
      await p.getByText(L.go, { exact: true }).last().click(); await p.waitForTimeout(4000);
      await p.goto(`${base}/settings/notifications`); await p.waitForTimeout(3500);
      const head = p.getByText(he ? 'החלפת סט' : 'Infusion set change', { exact: true }).last();
      ok(`${lang} ${scheme}: owner set reminder card`, (await head.count()) > 0);
      if (await head.count()) await head.scrollIntoViewIfNeeded();
      await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(out, `${lang}-${scheme}-04-owner-set-reminder.png`) });
      const box = p.getByTestId('setr-5');
      if (await box.count()) {
        await box.click(); await p.waitForTimeout(1500);
        const s = (await api('/settings', { token: kid })).json;
        ok(`${lang} ${scheme}: owner set reminder saved`, JSON.stringify(s.set_end_reminder) === '[5]', JSON.stringify(s.set_end_reminder));
        await box.click(); await p.waitForTimeout(1200);
      } else ok(`${lang} ${scheme}: owner set reminder checkbox`, false);
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
