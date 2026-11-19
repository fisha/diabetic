// All notifications switch (PM-279, Guy 19 Nov 2026) end to end against the test server (services/api: uvicorn
// tests.e2e_server:app): the first row on Profile > Notifications turns every notification off with one tap, every
// other row then shows off and locked, the server has it at once, Profile says "All off", and turning it back on
// brings back the person's own choices (insight pushes stay off) instead of switching everything on.
// Usage: node tools/e2e/notify-all.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <out dir>
// Start from an empty database: it signs up na-en@example.com and na-he@example.com.
const http = require('http'); const fs = require('fs'); const path = require('path'); const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
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

async function setup(email, locale) {
  await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
  const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
  const docs = (await api('/consent', { token: tk })).json;
  await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
  await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
  await api('/profile', { method: 'PUT', token: tk, body: { locale, answers: ANSWERS } });
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
  let page;
  try {
    const tokens = { en: await setup('na-en@example.com', 'en'), he: await setup('na-he@example.com', 'he') };
    // A choice of the person's own that must come back after the master switch is turned on again.
    for (const tk of Object.values(tokens)) await api('/settings', { method: 'PATCH', token: tk, body: { insight_push: false } });
    for (const [who, scheme, size] of [['en', 'light', [390, 844]], ['he', 'light', [390, 844]], ['he', 'dark', [375, 667]]]) {
      const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(8000);
      const he = who === 'he';
      const tag = `${who} ${scheme} ${size[0]}`;
      const shot = (name, full = false) => page.screenshot({ path: path.join(out, `${who}-${scheme}-${size[0]}-${name}.png`), fullPage: full });
      const L = he
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', prof: 'פרופיל', notif: 'התראות', all: 'כל ההתראות', n1: 'שאלות מעקב', allOff: 'כולן כבויות' }
        : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', prof: 'Profile', notif: 'Notifications', all: 'All notifications', n1: 'Check-ins', allOff: 'All off' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill(`na-${who}@example.com`);
      await page.getByLabel(L.pw, { exact: true }).fill(PW);
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      const later = page.getByText(he ? 'אחר כך' : 'Later', { exact: true });
      if (await later.count()) { await later.last().click(); await page.waitForTimeout(1000); }
      const openNotif = async () => {
        await page.getByRole('tab', { name: L.prof }).first().click().catch(async () => page.getByText(L.prof, { exact: true }).last().click());
        await page.waitForTimeout(2500);
        await page.getByText(L.notif, { exact: true }).first().click(); await page.waitForTimeout(3000);
      };
      await openNotif();
      const master = page.getByRole('switch', { name: L.all, exact: true });
      const switches = page.getByRole('switch');
      ok(`${tag}: the master switch shows`, (await master.count()) === 1);
      const first = await switches.first().getAttribute('aria-label');
      ok(`${tag}: it is the first switch on the page`, first === L.all, String(first));
      const mb = await master.boundingBox(); const tb = await page.getByText(L.n1, { exact: true }).first().boundingBox();
      ok(`${tag}: it sits above the other rows`, !!mb && !!tb && mb.y < tb.y);
      const checked = async (loc) => (await loc.getAttribute('aria-checked')) === 'true' || (await loc.isChecked().catch(() => false));
      ok(`${tag}: master on at the start`, await checked(master));
      // On the web the phone-only rows follow the browser's permission, so compare with how they started.
      const checkInBefore = await checked(page.getByRole('switch', { name: L.n1, exact: true }));
      if (scheme === 'light' || size[0] === 375) await shot('01-on');
      await master.click(); await page.waitForTimeout(1500);
      ok(`${tag}: master off after one tap`, !(await checked(master)));
      const s1 = (await api('/settings', { token: tokens[who] })).json;
      ok(`${tag}: saved on the server at once`, s1.notifications_on === false);
      ok(`${tag}: the person's own choices are untouched`, s1.insight_push === false);
      const n = await switches.count(); let allOff = true; let allDisabled = true;
      for (let i = 1; i < n; i++) {
        const sw = switches.nth(i); const label = await sw.getAttribute('aria-label');
        if (label === (he ? 'חגיגה לפריטים חדשים של המלווה' : 'Celebrate new companion items')) continue;
        if (await checked(sw)) allOff = false;
        if (!(await sw.isDisabled().catch(() => false)) && (await sw.getAttribute('aria-disabled')) !== 'true') allDisabled = false;
      }
      ok(`${tag}: every other notification row shows off`, allOff, `${n - 1} rows`);
      ok(`${tag}: and can't be changed while off`, allDisabled);
      await shot('02-off');
      // Profile shows "All off" under Notifications.
      await page.goBack().catch(() => {}); await page.waitForTimeout(1500);
      await page.getByRole('tab', { name: L.prof }).first().click().catch(() => {}); await page.waitForTimeout(1500);
      ok(`${tag}: Profile row says all off`, (await page.getByText(L.allOff, { exact: true }).count()) > 0);
      if (scheme === 'light') await shot('03-profile');
      // Survives a reload.
      await page.reload(); await page.waitForTimeout(5000);
      await openNotif();
      ok(`${tag}: still off after a reload`, !(await checked(page.getByRole('switch', { name: L.all, exact: true }))));
      await page.getByRole('switch', { name: L.all, exact: true }).click(); await page.waitForTimeout(1500);
      const s2 = (await api('/settings', { token: tokens[who] })).json;
      ok(`${tag}: back on, saved`, s2.notifications_on === true);
      const ins = page.getByRole('switch', { name: he ? 'התראות על תובנות' : 'Insight notifications', exact: true });
      const insOk = (await ins.count()) === 0 ? s2.insight_push === false : !(await checked(ins)) && s2.insight_push === false;
      ok(`${tag}: own choice restored (insight pushes stay off)`, insOk);
      ok(`${tag}: check-ins back as they were`, (await checked(page.getByRole('switch', { name: L.n1, exact: true }))) === checkInBefore);
      await ctx.close();
    }
  } catch (e) {
    ok('run', false, e.message.split('\n')[0]);
    if (page) await page.screenshot({ path: path.join(out, 'error.png') }).catch(() => {});
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  const failed = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`${results.length - failed}/${results.length} passed`);
  await browser.close(); server.close(); process.exit(failed ? 1 : 0);
});
