// "Sensor ending" reminder choice (PM-260, Guy 18 Nov 2026) end to end against the test server (services/api: uvicorn
// tests.e2e_server:app): Profile > Notifications shows a choice per sensor type the connected device services can tell
// the end of (Off / 3 days / 24 hours / 5 hours), saves it on the server, and without such a service says what to connect.
// The device links are written straight into the test database (no device service is reached).
// Usage: node tools/e2e/sensor-end.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <out dir> <psql url>
// Start from an empty database: it signs up se-en@example.com, se-he@example.com and se-none@example.com.
const http = require('http'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; const db = process.argv[4]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const PW = 'correct horse battery';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  let json = null; try { json = await r.json(); } catch { /* empty */ }
  return { status: r.status, json };
};
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensor: 'libre3', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '80-160' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Sol', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };

async function setup(email, locale, links) {
  await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
  const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
  const docs = (await api('/consent', { token: tk })).json;
  await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
  await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
  await api('/profile', { method: 'PUT', token: tk, body: { locale, answers: ANSWERS } });
  for (const [kind, device] of links) {
    execFileSync('psql', [db, '-qc', `INSERT INTO device_links (id, user_id, kind, region, sealed, status, device) SELECT gen_random_uuid(), id, '${kind}', 'eu', 'x', 'connected', '${JSON.stringify(device)}'::jsonb FROM users WHERE email = '${email}'`]);
  }
  return tk;
}

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8093, async () => {
  const base = 'http://localhost:8093';
  const browser = await chromium.launch();
  const errors = [];
  let page;
  try {
    const tokens = {
      en: await setup('se-en@example.com', 'en', [['libre', {}], ['tandem', { cgm: 399 }]]),
      he: await setup('se-he@example.com', 'he', [['libre', {}], ['tandem', { cgm: 399 }]]),
      none: await setup('se-none@example.com', 'en', []),
    };
    for (const [who, lang, scheme] of [['en', 'en', 'light'], ['he', 'he', 'light'], ['he', 'he', 'dark'], ['none', 'en', 'light']]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(8000);
      const he = lang === 'he';
      const shot = (name) => page.screenshot({ path: path.join(out, `${who}-${scheme}-${name}.png`), fullPage: true });
      const L = he
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', prof: 'פרופיל', notif: 'התראות', title: 'סיום חיישן', libre: 'FreeStyle Libre', g7: 'Dexcom G7', d3: '3 ימים', h24: '24 שעות', h5: '5 שעות', off: 'כבוי' }
        : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', prof: 'Profile', notif: 'Notifications', title: 'Sensor ending', libre: 'FreeStyle Libre', g7: 'Dexcom G7', d3: '3 days', h24: '24 hours', h5: '5 hours', off: 'Off' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill(`se-${who}@example.com`);
      await page.getByLabel(L.pw, { exact: true }).fill(PW);
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      const later = page.getByText(he ? 'אחר כך' : 'Later', { exact: true });
      if (await later.count()) { await later.last().click(); await page.waitForTimeout(1000); }
      await page.getByRole('tab', { name: L.prof }).first().click().catch(async () => page.getByText(L.prof, { exact: true }).last().click());
      await page.waitForTimeout(2500);
      await page.getByText(L.notif, { exact: true }).first().click(); await page.waitForTimeout(3000);
      const title = page.getByText(L.title, { exact: true });
      ok(`${who} ${scheme}: the Sensor ending card shows`, (await title.count()) > 0);
      await title.first().scrollIntoViewIfNeeded();
      if (who === 'none') {
        ok('none: says what to connect, no choices', (await page.getByText(/LibreLinkUp/).count()) > 0 && (await page.getByRole('radiogroup', { name: L.libre }).count()) === 0);
        await shot('01-no-device');
        await ctx.close();
        continue;
      }
      const libre = page.getByRole('radiogroup', { name: L.libre }); const g7 = page.getByRole('radiogroup', { name: L.g7 });
      ok(`${who} ${scheme}: a choice per sensor type`, (await libre.count()) === 1 && (await g7.count()) === 1);
      ok(`${who} ${scheme}: all four options`, (await libre.getByRole('radio').count()) === 4, String(await libre.getByRole('radio').count()));
      if (scheme === 'light') {
        await libre.getByText(L.d3, { exact: true }).click(); await page.waitForTimeout(1200);
        await g7.getByText(L.h5, { exact: true }).click(); await page.waitForTimeout(1200);
        const s = (await api('/settings', { token: tokens[who] })).json;
        ok(`${who}: saved per type on the server`, s.sensor_end_reminder.libre3 === 72 && s.sensor_end_reminder.dexcomG7 === 5, JSON.stringify(s.sensor_end_reminder));
        await shot('01-chosen');
        await page.reload(); await page.waitForTimeout(4000);
        const r = page.getByRole('radiogroup', { name: L.libre });
        await r.first().scrollIntoViewIfNeeded();
        const sel = await r.getByRole('radio').evaluateAll((els) => els.map((e) => `${e.textContent}=${!!e.querySelector('svg')}`));
        ok(`${who}: the choice is shown again after reload`, sel.some((x) => x.startsWith(L.d3) && x.endsWith('=true')), sel.join('|'));
        await r.getByText(L.off, { exact: true }).click(); await page.waitForTimeout(1200);
        const s2 = (await api('/settings', { token: tokens[who] })).json;
        ok(`${who}: Off removes that type only`, !('libre3' in s2.sensor_end_reminder) && s2.sensor_end_reminder.dexcomG7 === 5, JSON.stringify(s2.sensor_end_reminder));
      } else {
        await shot('01-chosen');
      }
      await ctx.close();
    }
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); if (page) await page.screenshot({ path: path.join(out, 'zz-fail.png') }).catch(() => {});
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
  process.exit(results.some((r) => !r.startsWith('PASS')) ? 1 : 0);
});
