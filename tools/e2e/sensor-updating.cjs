// "Sensor updating" (PM-320, Guy 19 Nov 2026): while the pump says the sensor is updating, the main screen shows
// "Sensor updating" with a timer counting up how long, like the warm-up, and never the last reading as if current.
// Also on a follower's screen. Against the test server (services/api: uvicorn tests.e2e_server:app) and an empty
// database; the CareLink link and its "Sensor updating" message are written straight into the test database.
// Usage: node tools/e2e/sensor-updating.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <out dir> <psql url>
const http = require('http'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; const db = process.argv[4]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const PW = 'correct horse battery';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  let json = null; try { json = await r.json(); } catch { /* empty */ }
  return { status: r.status, json };
};
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '70-180' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Stedio', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };
const sql = (q) => execFileSync('psql', [db, '-qc', q]);

async function account(email, name, locale) {
  await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
  const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
  const docs = (await api('/consent', { token: tk })).json;
  await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
  await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
  await api('/profile', { method: 'PUT', token: tk, body: { locale, answers: { ...ANSWERS, companion: { ...ANSWERS.companion, callMe: name } } } });
  return tk;
}

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8094, async () => {
  const base = 'http://localhost:8094';
  const browser = await chromium.launch();
  const errors = [];
  try {
    const son = await account('up-son@example.com', 'יונתן', 'he');
    const dad = await account('up-dad@example.com', 'Guy', 'he');
    // Readings until 40 minutes ago, the last one 187 (so an old value would be easy to spot), then the update.
    const items = []; let n = 0;
    for (let t = Date.now() - 6 * 3600000; t <= Date.now() - 40 * 60000; t += 5 * 60000) items.push({ sample_id: `sensor-updating-${n++}`, measured_at: new Date(t).toISOString(), value: 120, unit: 'mg/dL', method: 'sensor' });
    items[items.length - 1].value = 187;
    const imp = await api('/glucose/import', { method: 'POST', token: son, body: { store: 'health_connect', items } });
    ok('readings imported', imp.status < 300, String(imp.status));
    const status = JSON.stringify({ status: { at: new Date().toISOString(), sensor_state: 'NO_ERROR_MESSAGE' } });
    sql(`INSERT INTO device_links (id, user_id, kind, region, sealed, status, device) SELECT gen_random_uuid(), id, 'carelink', 'eu', 'x', 'connected', '${status}'::jsonb FROM users WHERE email = 'up-son@example.com'`);
    const since = new Date(Date.now() - 23 * 60000).toISOString();
    sql(`INSERT INTO device_events (id, user_id, idempotency_key, source, occurred_at, kind, code) SELECT gen_random_uuid(), id, 'up-801', 'carelink', '${since}', 'alert', '801' FROM users WHERE email = 'up-son@example.com'`);
    const w = (await api('/devices/warmup', { token: son })).json;
    ok('API: the update is known', w && w.updating && w.updating.source === 'carelink', JSON.stringify(w));
    const inv = (await api('/sharing/invites', { method: 'POST', token: son, body: { scopes: ['glucose'], relation: 'dad', consent: true } })).json;
    const acc = await api('/sharing/accept', { method: 'POST', token: dad, body: { code: inv.code } });
    ok('share accepted', acc.status === 200 || acc.status === 201, String(acc.status));

    for (const [lang, scheme, who] of [['he', 'light', 'son'], ['en', 'light', 'son'], ['he', 'dark', 'son'], ['he', 'light', 'dad']]) {
      const he = lang === 'he';
      const tk = who === 'son' ? son : dad;
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: { ...ANSWERS, companion: { ...ANSWERS.companion, callMe: who === 'son' ? 'יונתן' : 'Guy' } } } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: he ? 'he-IL' : 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(6000);
      const shot = (name) => page.screenshot({ path: path.join(out, `${who}-${lang}-${scheme}-${name}.png`) });
      const body = () => page.evaluate(() => document.body.innerText);
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click().catch(() => null); await page.waitForTimeout(800); }
      await page.getByText(he ? 'כבר יש לי חשבון' : 'I already have an account', { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(he ? 'אימייל' : 'Email', { exact: true }).fill(`up-${who}@example.com`);
      await page.getByLabel(he ? 'סיסמה' : 'Password', { exact: true }).fill(PW);
      await page.getByText(he ? 'כניסה' : 'Sign in', { exact: true }).last().click(); await page.waitForTimeout(5000);
      await page.getByText(he ? 'אחר כך' : 'Later', { exact: true }).last().click({ timeout: 1500 }).catch(() => null); await page.waitForTimeout(600);
      if (who === 'dad') {
        await page.getByText(he ? 'החלפה' : 'Switch', { exact: true }).first().click(); await page.waitForTimeout(1000);
        await page.getByText('יונתן', { exact: true }).last().click(); await page.waitForTimeout(4000);
      }
      await page.getByRole('tab', { name: he ? 'שיחה' : 'Talk' }).first().click().catch(() => null);
      await page.waitForTimeout(2500);
      const label = `${who} ${lang} ${scheme}`;
      const a = await body(); await shot('01-main');
      await page.waitForTimeout(2200);
      const b = await body();
      ok(`${label}: says the sensor is updating`, (he ? /החיישן מתעדכן/ : /Sensor updating/i).test(a));
      ok(`${label}: says there is no current reading`, (he ? /אין מדידה עדכנית/ : /No current reading/i).test(a));
      const clock = (s) => (s.match(/00:2\d:\d\d/) || [null])[0];
      ok(`${label}: a timer counts up from the start (about 23 min)`, clock(a) && clock(b) && clock(a) !== clock(b), `${clock(a)} -> ${clock(b)}`);
      ok(`${label}: the old reading 187 is not shown`, !/\b187\b/.test(a));
      // In a conversation the main screen keeps one line: the same state, compact.
      const text = page.getByRole('button', { name: he ? 'הקלדה' : 'Type' }).first();
      if (who === 'son' && (await text.count())) {
        await text.click().catch(() => null); await page.waitForTimeout(1500);
        const c = await body(); await shot('02-text-mode');
        ok(`${label}: in text mode too, with the timer`, (he ? /החיישן מתעדכן/ : /Sensor updating/i).test(c) && !!clock(c) && !/\b187\b/.test(c));
      }
      // A follower's Talk tab has no reading; the Overview's latest-reading card shows the update instead of the value.
      await page.getByRole('tab', { name: he ? 'סקירה' : 'Overview' }).first().click().catch(() => null);
      await page.waitForTimeout(3000); await shot('03-overview');
      const o = await page.evaluate(() => document.body.innerText);
      ok(`${label}: Overview says it too, with the timer and no old value`, (he ? /החיישן מתעדכן/ : /Sensor updating/i).test(o) && !!clock(o) && (he ? /המשאבה מדווחת שהחיישן מתעדכן/ : /the pump says the sensor is updating/).test(o));
      fs.writeFileSync(path.join(out, `${who}-${lang}-${scheme}-text.txt`), a);
      await ctx.close();
    }
  } catch (e) {
    results.push(`FAIL exception — ${e.message.split('\n')[0]}`);
  } finally {
    ok('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length}`);
    await browser.close(); server.close();
  }
});
